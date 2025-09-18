import type { RequestHandler } from "express";
import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const CONFIG_PATH = path.join(process.cwd(), "public", "config.json");
const PLAYLIST_PATH = path.join(process.cwd(), "public", "playlist.json");

// ---- Helpers: config and auth ----
interface AdminConfig {
  username: string;
  passwordHash: string; // base64 scrypt hash
  passwordSalt: string; // base64 salt
  scryptParams?: { N?: number; r?: number; p?: number; keylen?: number };
}

async function readConfig(): Promise<any> {
  const txt = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(txt);
}

function bufEq(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function scryptVerify(
  password: string,
  saltB64: string,
  hashB64: string,
  params?: { N?: number; r?: number; p?: number; keylen?: number },
): Promise<boolean> {
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const N = params?.N ?? 16384;
  const r = params?.r ?? 8;
  const p = params?.p ?? 1;
  const keylen = params?.keylen ?? 64;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N, r, p }, (err, dk) =>
      err ? reject(err) : resolve(dk as Buffer),
    );
  });
  return bufEq(derived, expected);
}

async function getAdminConfig(): Promise<AdminConfig | null> {
  try {
    const cfg = await readConfig();
    const admin = cfg?.admin;
    if (!admin || !admin.username || !admin.passwordHash || !admin.passwordSalt)
      return null;
    return {
      username: String(admin.username),
      passwordHash: String(admin.passwordHash),
      passwordSalt: String(admin.passwordSalt),
      scryptParams:
        admin.scryptParams && typeof admin.scryptParams === "object"
          ? admin.scryptParams
          : undefined,
    };
  } catch {
    return null;
  }
}

const requireAdminBasic: RequestHandler = async (req, res, next) => {
  try {
    const admin = await getAdminConfig();
    if (!admin)
      return res
        .status(500)
        .json({ error: "Admin não configurado em config.json" });
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Basic "))
      return res.status(401).json({ error: "Auth necessária" });
    const base64 = auth.slice(6);
    let user = "";
    let pass = "";
    try {
      const decoded = Buffer.from(base64, "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      user = decoded.slice(0, idx);
      pass = decoded.slice(idx + 1);
    } catch {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    if (user !== admin.username)
      return res.status(401).json({ error: "Credenciais inválidas" });
    const ok = await scryptVerify(
      pass,
      admin.passwordSalt,
      admin.passwordHash,
      admin.scryptParams,
    );
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });
    return next();
  } catch (e) {
    return res.status(500).json({ error: "Erro de autenticação" });
  }
};

// ---- Playlist file helpers ----
async function readPlaylistArray(): Promise<any[]> {
  try {
    const txt = await fs.readFile(PLAYLIST_PATH, "utf8");
    const data = JSON.parse(txt);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).items))
      return (data as any).items as any[];
    return [];
  } catch {
    return [];
  }
}

async function writePlaylistArray(arr: any[]): Promise<void> {
  const json = JSON.stringify(arr, null, 2) + "\n";
  await fs.writeFile(PLAYLIST_PATH, json, "utf8");
}

// ---- Router ----
export const adminRouter = Router();

// POST /api/admin/hash { password } -> returns fields to put in config.json
adminRouter.post("/hash", async (req, res) => {
  const schema = z.object({ password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Password inválida" });
  const salt = crypto.randomBytes(16);
  const keylen = 64;
  const N = 16384,
    r = 8,
    p = 1;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(parsed.data.password, salt, keylen, { N, r, p }, (err, dk) =>
      err ? reject(err) : resolve(dk as Buffer),
    );
  });
  res.json({
    passwordSalt: salt.toString("base64"),
    passwordHash: derived.toString("base64"),
    scryptParams: { N, r, p, keylen },
  });
});

// POST /api/admin/login { username, password } -> 200 if ok
adminRouter.post("/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Dados inválidos" });
  const admin = await getAdminConfig();
  if (!admin)
    return res
      .status(500)
      .json({ error: "Admin não configurado em config.json" });
  const { username, password } = parsed.data;
  if (username !== admin.username)
    return res.status(401).json({ error: "Credenciais inválidas" });
  const ok = await scryptVerify(
    password,
    admin.passwordSalt,
    admin.passwordHash,
    admin.scryptParams,
  );
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });
  return res.status(200).json({ ok: true });
});

// GET /api/admin/playlist -> list items (protected)
adminRouter.get("/playlist", requireAdminBasic, async (_req, res) => {
  const items = await readPlaylistArray();
  // Include a volatile index for editing
  const withIdx = items.map((it, idx) => ({ _idx: idx, ...it }));
  res.json({ items: withIdx });
});

const eventSchema = z.object({
  id: z.string().min(1), // YouTube id or URL
  startTime: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  playerName: z.string().min(1),
  playerNumber: z.number().int().nonnegative(),
  playerPhoto: z.string().url().or(z.string().min(1)),
  title: z.string().min(1),
  jogo: z.string().min(1),
  campeonato: z.string().min(1),
});

// POST /api/admin/playlist -> add new event
adminRouter.post("/playlist", requireAdminBasic, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Dados inválidos" });
  const items = await readPlaylistArray();
  items.push(parsed.data);
  await writePlaylistArray(items);
  res.status(201).json({ ok: true });
});

// PUT /api/admin/playlist/:idx -> update by index
adminRouter.put("/playlist/:idx", requireAdminBasic, async (req, res) => {
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0)
    return res.status(400).json({ error: "Índice inválido" });
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Dados inválidos" });
  const items = await readPlaylistArray();
  if (idx >= items.length)
    return res.status(404).json({ error: "Evento não encontrado" });
  items[idx] = parsed.data;
  await writePlaylistArray(items);
  res.json({ ok: true });
});

// DELETE /api/admin/playlist/:idx -> remove by index
adminRouter.delete("/playlist/:idx", requireAdminBasic, async (req, res) => {
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0)
    return res.status(400).json({ error: "Índice inválido" });
  const items = await readPlaylistArray();
  if (idx >= items.length)
    return res.status(404).json({ error: "Evento não encontrado" });
  items.splice(idx, 1);
  await writePlaylistArray(items);
  res.json({ ok: true });
});
