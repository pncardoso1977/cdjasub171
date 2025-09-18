import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GroupKind, PlaylistItem, groupBy } from "../lib/playlist";

interface PlaylistMenuProps {
  items: PlaylistItem[];
  open: boolean;
  onClose: () => void;
  onSelectAll: () => void; // Inicial (ordem padrão)
  onSelectShuffle: () => void; // Aleatório
  onSelectRecent: () => void; // Recente (invertido)
  onSelectGroup: (kind: GroupKind, value: string) => void;
  onSelectVideo: (
    itemId: string,
    context?: { kind: GroupKind; value: string },
  ) => void;
}

export default function PlaylistMenu({
  items,
  open,
  onClose,
  onSelectAll,
  onSelectShuffle,
  onSelectRecent,
  onSelectGroup,
  onSelectVideo,
}: PlaylistMenuProps) {
  const byNome = useMemo(() => groupBy(items, "nome"), [items]);
  const byCampThenJogo = useMemo(() => {
    const camp = new Map<string, Map<string, PlaylistItem[]>>();
    for (const it of items) {
      const c = it.campeonato || "Sem campeonato";
      let jogos = camp.get(c);
      if (!jogos) {
        jogos = new Map();
        camp.set(c, jogos);
      }
      const arr = jogos.get(it.jogo) ?? [];
      arr.push(it);
      jogos.set(it.jogo, arr);
    }
    return camp;
  }, [items]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});

  const Section = ({
    title,
    groups,
    kind,
    secKey,
  }: {
    title: string;
    groups: Map<string, PlaylistItem[]>;
    kind: GroupKind;
    secKey: string;
  }) => (
    <div className="mb-3 border border-border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary hover:opacity-95"
        onClick={() => setSectionOpen((s) => ({ ...s, [secKey]: !s[secKey] }))}
      >
        <span className="text-sm uppercase tracking-wider">{title}</span>
        <span
          className={`transition-transform ${sectionOpen[secKey] ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {sectionOpen[secKey] && (
        <div className="p-2 space-y-2">
          {Array.from(groups.entries())
            .sort((a, b) => {
              if (kind !== "nome") return 0;
              const aKey = a[0];
              const bKey = b[0];
              const re = /\bgolo(s)?\s+sofrid/i;
              const aIsSofrido = re.test(aKey);
              const bIsSofrido = re.test(bKey);
              if (aIsSofrido && !bIsSofrido) return 1;
              if (!aIsSofrido && bIsSofrido) return -1;
              return aKey.localeCompare(bKey, "pt", { sensitivity: "base" });
            })
            .map(([key, list]) => (
              <div key={kind + key} className="bg-secondary/60 rounded-md">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary rounded-md"
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [kind + key]: !e[kind + key] }))
                  }
                >
                  <span
                    className="font-medium"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectGroup(kind, key);
                      onClose();
                    }}
                  >
                    {key}
                  </span>
                  <span className="text-xs opacity-70">{list.length}</span>
                </button>
                {expanded[kind + key] && (
                  <div className="pl-3 pb-2 space-y-1">
                    {list.map((it) => {
                      const isGoal = /\bgolo\b/i.test(it.title || "");
                      const isDefense = /\bdefesa\b|guarda|save/i.test(
                        it.title || "",
                      );
                      const ballUrl =
                        "https://cdn.builder.io/api/v1/image/assets%2F7a544d0a166a4a1b860d1d21e3ff9c69%2Fae4f9af14949420eb1c067f0c09cbb42?format=webp&width=800";
                      const glovesUrl =
                        "https://cdn.builder.io/api/v1/image/assets%2F7a544d0a166a4a1b860d1d21e3ff9c69%2F035d976e8f994337997376fa835b2065?format=webp&width=800";
                      return (
                        <button
                          key={it.id}
                          className="w-full text-left text-sm px-2 py-1 rounded hover:bg-secondary/70 flex items-center gap-2"
                          onClick={() => {
                            onSelectVideo(it.id, { kind, value: key });
                            onClose();
                          }}
                        >
                          {isDefense ? (
                            <img
                              src={glovesUrl}
                              alt="Defesa"
                              className="h-4 w-4 object-contain opacity-90"
                            />
                          ) : isGoal ? (
                            <img
                              src={ballUrl}
                              alt="Golo"
                              className="h-4 w-4 object-contain opacity-90"
                            />
                          ) : null}
                          <span className="opacity-80">{it.jogo}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`absolute left-0 top-0 h-full w-[86%] max-w-md bg-background border-r border-border shadow-lg transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">Playlist</h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded bg-secondary hover:opacity-90"
          >
            Fechar
          </button>
        </div>
        <div className="p-4 overflow-y-auto h-[calc(100%-56px)]">
          <div className="space-y-2 mb-6">
            <Link
              to="/admin"
              onClick={onClose}
              className="block w-full px-4 py-2 rounded bg-secondary text-foreground font-semibold hover:opacity-95 text-center"
            >
              Admin
            </Link>
            <button
              className="w-full px-4 py-2 rounded bg-primary text-primary-foreground font-semibold hover:opacity-95"
              onClick={() => {
                onSelectAll();
                onClose();
              }}
            >
              Inicial
            </button>
            <button
              className="w-full px-4 py-2 rounded bg-primary text-primary-foreground font-semibold hover:opacity-95"
              onClick={() => {
                onSelectShuffle();
                onClose();
              }}
            >
              Aleatório
            </button>
            <button
              className="w-full px-4 py-2 rounded bg-primary text-primary-foreground font-semibold hover:opacity-95"
              onClick={() => {
                onSelectRecent();
                onClose();
              }}
            >
              Recente
            </button>
          </div>
          <Section
            title="Por Jogador"
            groups={byNome}
            kind="nome"
            secKey="sec-nome"
          />

          {/* Por Jogo > Campeonato */}
          <div className="mb-3 border border-border rounded-md overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-secondary hover:opacity-95"
              onClick={() =>
                setSectionOpen((s) => ({ ...s, ["sec-jogo"]: !s["sec-jogo"] }))
              }
            >
              <span className="text-sm uppercase tracking-wider">Por Jogo</span>
              <span
                className={`transition-transform ${sectionOpen["sec-jogo"] ? "rotate-90" : ""}`}
              >
                ›
              </span>
            </button>
            {sectionOpen["sec-jogo"] && (
              <div className="p-2 space-y-2">
                {Array.from(byCampThenJogo.entries()).map(([camp, jogoMap]) => (
                  <div
                    key={"camp-" + camp}
                    className="bg-secondary/60 rounded-md"
                  >
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary rounded-md"
                      onClick={() =>
                        setExpanded((e) => ({
                          ...e,
                          ["camp-" + camp]: !e["camp-" + camp],
                        }))
                      }
                    >
                      <span className="font-medium">{camp}</span>
                      <span className="text-xs opacity-70">
                        {Array.from(jogoMap.values()).reduce(
                          (n, arr) => n + arr.length,
                          0,
                        )}
                      </span>
                    </button>
                    {expanded["camp-" + camp] && (
                      <div className="pl-3 pb-2 space-y-1">
                        {Array.from(jogoMap.entries()).map(([jogo, list]) => (
                          <button
                            key={camp + "-" + jogo}
                            className="w-full flex items-center justify-between text-left text-sm px-2 py-1 rounded hover:bg-secondary/70"
                            onClick={() => {
                              onSelectGroup("jogo", jogo);
                              onClose();
                            }}
                          >
                            <span className="opacity-90">{jogo}</span>
                            <span className="text-xs opacity-70">
                              {list.length}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
