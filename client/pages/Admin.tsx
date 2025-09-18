import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

interface RawEvent {
  id: string;
  startTime: number | string;
  playerName: string;
  playerNumber: number;
  playerPhoto: string;
  title: string;
  jogo: string;
  campeonato: string;
  _idx?: number;
}

export default function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RawEvent[]>([]);
  const [editing, setEditing] = useState<RawEvent | null>(null);
  const [selectedJogo, setSelectedJogo] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("adminAuth");
    if (saved) setAuth(saved);
  }, []);

  useEffect(() => {
    if (!auth) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/playlist", {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (!res.ok) throw new Error("Falha a carregar eventos");
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e: any) {
        setError(e?.message || "Erro");
      }
    })();
  }, [auth]);

  const isLoggedIn = useMemo(() => !!auth, [auth]);
  const jogos = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.jogo) set.add(it.jogo);
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt", { sensitivity: "base" }),
    );
  }, [items]);
  const visibleItems = useMemo(
    () =>
      selectedJogo ? items.filter((it) => it.jogo === selectedJogo) : items,
    [items, selectedJogo],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("Credenciais inválidas");
      const token = btoa(`${username}:${password}`);
      localStorage.setItem("adminAuth", token);
      setAuth(token);
      setPassword("");
    } catch (e: any) {
      setError(e?.message || "Erro a autenticar");
    }
  };

  const resetForm = () => setEditing(null);

  const onEdit = (ev: RawEvent) => setEditing({ ...ev });

  const onDelete = async (ev: RawEvent) => {
    if (!auth || ev._idx == null) return;
    const ok = window.confirm(
      `Apagar o evento de ${ev.playerName} — ${ev.title}?`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/playlist/${ev._idx}`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) throw new Error("Falha a apagar");
      const listRes = await fetch("/api/admin/playlist", {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await listRes.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
      if (editing && editing._idx === ev._idx) setEditing(null);
    } catch (e: any) {
      setError(e?.message || "Erro a apagar");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !editing) return;
    const body: RawEvent = {
      id: editing.id.trim(),
      startTime:
        typeof editing.startTime === "string"
          ? editing.startTime.trim()
          : Number(editing.startTime) || 0,
      playerName: editing.playerName.trim(),
      playerNumber: Number(editing.playerNumber) || 0,
      playerPhoto: editing.playerPhoto.trim(),
      title: editing.title.trim(),
      jogo: editing.jogo.trim(),
      campeonato: editing.campeonato.trim(),
    };
    const isUpdate = editing._idx != null;
    try {
      const res = await fetch(
        isUpdate
          ? `/api/admin/playlist/${editing._idx}`
          : "/api/admin/playlist",
        {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("Falha a guardar");
      // reload
      const listRes = await fetch("/api/admin/playlist", {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await listRes.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setEditing(null);
    } catch (e: any) {
      setError(e?.message || "Erro a guardar");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Área de Admin</h1>
        <Link to="/" className="text-sm underline">
          Voltar
        </Link>
      </div>
      {!isLoggedIn ? (
        <form
          onSubmit={handleLogin}
          className="max-w-sm space-y-3 bg-secondary/40 p-4 rounded border border-border"
        >
          <div>
            <label className="block text-sm mb-1">Utilizador</label>
            <input
              className="w-full px-3 py-2 rounded bg-background border border-border"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded bg-background border border-border"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <button className="px-4 py-2 rounded bg-primary text-primary-foreground">
            Entrar
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Eventos</h2>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm">Jogo</label>
              <select
                className="px-2 py-1 rounded bg-background border border-border"
                value={selectedJogo}
                onChange={(e) => setSelectedJogo(e.target.value)}
              >
                <option value="">Todos</option>
                {jogos.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-2">
              {visibleItems.map((it) => (
                <div
                  key={(it._idx ?? 0) + "-" + it.id + "-" + it.startTime}
                  className="p-3 bg-secondary/40 border border-border rounded flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {it.playerName} — {it.title}
                    </div>
                    <div className="text-xs opacity-80 truncate">
                      {it.jogo} • {it.campeonato} •{" "}
                      {typeof it.startTime === "string"
                        ? it.startTime
                        : `${it.startTime}s`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(it)}
                      className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(it)}
                      className="text-sm px-3 py-1 rounded bg-red-600 text-white"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))}
              {visibleItems.length === 0 && (
                <div className="text-sm opacity-70">Sem eventos</div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">
              {editing ? "Editar evento" : "Novo evento"}
            </h2>
            <form
              onSubmit={onSubmit}
              className="space-y-3 bg-secondary/40 p-4 rounded border border-border"
            >
              <div>
                <label className="block text-sm mb-1">YouTube ID ou URL</label>
                <input
                  className="w-full px-3 py-2 rounded bg-background border border-border"
                  value={editing?.id ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...(s || {
                        id: "",
                        startTime: 0,
                        playerName: "",
                        playerNumber: 0,
                        playerPhoto: "",
                        title: "",
                        jogo: "",
                        campeonato: "",
                      }),
                      id: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  Tempo inicial (segundos ou mm:ss)
                </label>
                <input
                  className="w-full px-3 py-2 rounded bg-background border border-border"
                  value={editing?.startTime ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...(s as any),
                      startTime: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Jogador (nome)</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-background border border-border"
                    value={editing?.playerName ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({
                        ...(s as any),
                        playerName: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Nº</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 rounded bg-background border border-border"
                    value={editing?.playerNumber ?? 0}
                    onChange={(e) =>
                      setEditing((s) => ({
                        ...(s as any),
                        playerNumber: Number(e.target.value),
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Foto (URL)</label>
                <input
                  className="w-full px-3 py-2 rounded bg-background border border-border"
                  value={editing?.playerPhoto ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...(s as any),
                      playerPhoto: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Jogo</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-background border border-border"
                    value={editing?.jogo ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({
                        ...(s as any),
                        jogo: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Campeonato</label>
                  <input
                    className="w-full px-3 py-2 rounded bg-background border border-border"
                    value={editing?.campeonato ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({
                        ...(s as any),
                        campeonato: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Título</label>
                <input
                  className="w-full px-3 py-2 rounded bg-background border border-border"
                  value={editing?.title ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...(s as any),
                      title: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-primary text-primary-foreground"
                >
                  {editing?._idx != null ? "Guardar" : "Adicionar"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 rounded bg-secondary"
                >
                  Limpar
                </button>
              </div>
              {error && <div className="text-sm text-red-500">{error}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
