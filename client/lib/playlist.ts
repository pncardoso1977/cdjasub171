export interface PlaylistItem {
  id: string;
  nome: string;
  numero: number;
  foto: string;
  videoUrl: string;
  jogo: string; // nome do jogo (antes: evento)
  campeonato: string; // novo campo
  title: string; // destaque
  startAtSec: number;
}

export async function loadPlaylist(): Promise<PlaylistItem[]> {
  const res = await fetch("/playlist.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha a carregar /playlist.json");
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.items) ? (raw as any).items : [];
  return arr.map((r: any, idx: number) => normalizeItem(r, idx));
}

function parseStartTime(input: unknown): number {
  if (input == null) return 0;
  if (typeof input === "number" && isFinite(input)) return Math.max(0, Math.floor(input));
  const str = String(input).trim();
  if (!str) return 0;
  // Support formats: ss, mm:ss, hh:mm:ss, and XmYs
  const ms = str.match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (ms) {
    const a = ms[3] != null ? [Number(ms[1]), Number(ms[2]), Number(ms[3])] : [0, Number(ms[1]), Number(ms[2])];
    return Math.max(0, a[0] * 3600 + a[1] * 60 + a[2]);
  }
  const xs = str.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (xs) {
    const h = Number(xs[1] || 0);
    const m = Number(xs[2] || 0);
    const s = Number(xs[3] || 0);
    return Math.max(0, h * 3600 + m * 60 + s);
  }
  const n = Number(str);
  if (!isNaN(n)) return Math.max(0, Math.floor(n));
  return 0;
}

function normalizeItem(r: any, idx: number): PlaylistItem {
  const nome = (r["Nome do jogador"] ?? r.playerName ?? r.nome ?? "").toString().trim();
  const numero = Number(r["Numero do jogador"] ?? r.playerNumber ?? r.numero ?? 0) || 0;
  const foto = r["link foto jogador"] ?? r.playerPhoto ?? r.foto ?? r.fotoUrl ?? "";

  const idOrUrl = r["link video"] ?? r.video ?? r.videoUrl ?? r.id ?? "";
  const videoUrl = /^[a-zA-Z0-9_-]{6,}$/.test(String(idOrUrl))
    ? `https://www.youtube.com/watch?v=${idOrUrl}`
    : String(idOrUrl);

  const jogo = (r["jogo"] ?? r.jogo ?? r["evento"] ?? r.evento ?? "").toString();
  const campeonato = (r["campeonato"] ?? r.campeonato ?? "Jogo de Treino").toString();
  const title = (r["title"] ?? r.titulo ?? r.nomeLance ?? "").toString();

  // Prefer explicit start fields; fallback to URL params t/start
  const startRaw = r["tempo"] ?? r["início"] ?? r["inicio"] ?? r["start"] ?? r["startAt"] ?? r["start_at"] ?? r["startSeconds"] ?? r["startTime"] ?? 0;
  let startAtSec = parseStartTime(startRaw);
  if (!startAtSec) {
    try {
      const u = new URL(videoUrl);
      const t = u.searchParams.get("t") ?? u.searchParams.get("start");
      if (t) startAtSec = parseStartTime(t);
    } catch {}
  }

  return {
    id: `${idx}-${nome}-${numero}`,
    nome,
    numero,
    foto,
    videoUrl,
    jogo,
    campeonato,
    title,
    startAtSec,
  };
}

export type GroupKind = "nome" | "jogo" | "campeonato";

export function groupBy(items: PlaylistItem[], kind: GroupKind): Map<string, PlaylistItem[]> {
  const map = new Map<string, PlaylistItem[]>();
  for (const it of items) {
    const key = kind === "nome" ? it.nome : kind === "jogo" ? it.jogo : it.campeonato;
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  }
  return map;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const paths = u.pathname.split("/").filter(Boolean);
      const idx = paths.indexOf("embed");
      if (idx >= 0 && paths[idx + 1]) return paths[idx + 1];
    }
  } catch {
    if (/^[a-zA-Z0-9_-]{6,}$/.test(url)) return url;
  }
  return null;
}
