import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";
import PlaylistMenu from "@/components/PlaylistMenu";
import {
  GroupKind,
  PlaylistItem,
  extractYouTubeId,
  groupBy,
  loadPlaylist,
} from "@/lib/playlist";
import { applyThemeColors, loadSiteConfig, SiteConfig } from "@/lib/config";

const MUSIC_URL =
  "https://cdn.builder.io/o/assets%2F7a544d0a166a4a1b860d1d21e3ff9c69%2F9d3d646cc4c64c96b2c80c82ae7d704d?alt=media&token=54998bc3-29f3-48bb-b69c-fdd733a0cc2c&apiKey=7a544d0a166a4a1b860d1d21e3ff9c69";

export default function Index() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [allItems, setAllItems] = useState<PlaylistItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PlaylistItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fromMenu, setFromMenu] = useState(false);
  const [playerResetKey, setPlayerResetKey] = useState(0);
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const resetToHome = useCallback(() => {
    setFromMenu(false);
    const list = [...allItems];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    setFilteredItems(list);
    setCurrentIdx(0);
    setPlayerResetKey((k) => k + 1);
    setCoverVisible(true);
  }, [allItems]);
  const coverTimerRef = useRef<number | null>(null);
  const [coverVisible, setCoverVisible] = useState(false);

  const current = filteredItems[currentIdx] ?? null;
  const currentVideoId = useMemo(
    () => extractYouTubeId(current?.videoUrl ?? ""),
    [current],
  );

  // Load config + playlist
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await loadSiteConfig();
        if (!mounted) return;
        setConfig(cfg);
        document.title = cfg.title;
        applyThemeColors(cfg.colors);
      } catch {}
      try {
        const data = await loadPlaylist();
        if (!mounted) return;
        setAllItems(data);
        const list = [...data];
        for (let i = list.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
        setFilteredItems(list);
        setCurrentIdx(0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Background music: prepare only (no autoplay)
  useEffect(() => {
    const audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.3; // 30%
    audioRef.current = audio;
    return () => {
      try {
        audio.pause();
      } catch {}
      audioRef.current = null;
    };
  }, []);

  const toggleMusic = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (!musicOn) {
      try {
        await a.play();
        setMusicOn(true);
      } catch {}
    } else {
      try {
        a.pause();
        setMusicOn(false);
      } catch {}
    }
  }, [musicOn]);

  // Clear timers when changing video and show brief cover to hide YT title at start
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;

    if (coverTimerRef.current) window.clearTimeout(coverTimerRef.current);
    setCoverVisible(true);
    coverTimerRef.current = window.setTimeout(
      () => setCoverVisible(false),
      1200,
    );

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (coverTimerRef.current) window.clearTimeout(coverTimerRef.current);
    };
  }, [currentIdx, currentVideoId]);

  const next = useCallback(() => {
    const n = filteredItems.length;
    if (n === 0) return;
    if (fromMenu) {
      if (currentIdx + 1 >= n) {
        resetToHome();
        return;
      }
      setCurrentIdx(currentIdx + 1);
    } else {
      setCurrentIdx((i) => (n ? (i + 1) % n : 0));
    }
  }, [filteredItems.length, fromMenu, currentIdx, resetToHome]);

  const handleYTState = useCallback(
    (state: number) => {
      // 1 = PLAYING, 0 = ENDED
      if (state === 1) {
        setCoverVisible(false);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          next();
        }, 10000);
      } else if (state === 0) {
        next();
      }
    },
    [next],
  );

  const handleSelectAll = useCallback(() => {
    setFromMenu(true);
    setFilteredItems([...allItems]);
    setCurrentIdx(0);
  }, [allItems]);

  const handleSelectShuffle = useCallback(() => {
    setFromMenu(true);
    const list = [...allItems];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    setFilteredItems(list);
    setCurrentIdx(0);
  }, [allItems]);

  const handleSelectRecent = useCallback(() => {
    setFromMenu(true);
    const list = [...allItems].reverse();
    setFilteredItems(list);
    setCurrentIdx(0);
  }, [allItems]);

  const handleSelectGroup = useCallback(
    (kind: GroupKind, value: string) => {
      setFromMenu(true);
      setFilteredItems(() => {
        const m = groupBy(allItems, kind);
        const list = m.get(value) ?? [];
        return list;
      });
      setCurrentIdx(0);
    },
    [allItems],
  );

  const handleSelectVideo = useCallback(
    (itemId: string, context?: { kind: GroupKind; value: string }) => {
      setFromMenu(true);
      if (context) {
        const m = groupBy(allItems, context.kind);
        const list = m.get(context.value) ?? [];
        const idx = list.findIndex((it) => it.id === itemId);
        if (idx >= 0) {
          setFilteredItems(list);
          setCurrentIdx(idx);
          return;
        }
      }
      const idxAll = allItems.findIndex((it) => it.id === itemId);
      setFilteredItems([...allItems]);
      setCurrentIdx(Math.max(0, idxAll));
    },
    [allItems],
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center gap-3 justify-start px-4 md:px-6 bg-black/60">
        <div className="flex items-center gap-3">
          {config?.logoUrl && (
            <img
              src={config.logoUrl}
              alt="Clube"
              className="h-10 w-10 rounded object-cover border border-border"
            />
          )}
          <h1 className="text-2xl font-extrabold tracking-[-0.015em] leading-8">
            {config?.title || ""}
          </h1>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="order-first px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-95 shadow"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button
          onClick={toggleMusic}
          aria-label={musicOn ? "Desligar música" : "Ligar música"}
          className={`ml-auto px-3 py-2 rounded ${musicOn ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"} hover:opacity-95 shadow inline-flex items-center gap-2`}
        >
          {musicOn ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
          <span className="sr-only">Música</span>
        </button>
      </header>

      {/* Player area */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <div className="absolute inset-0 overflow-hidden">
              {!loading && currentVideoId ? (
                <div className="w-full h-full origin-center scale-[1.5] sm:scale-[1.3]">
                  <YouTubePlayer
                    key={playerResetKey}
                    videoId={currentVideoId}
                    startSeconds={current?.startAtSec ?? 0}
                    className="w-full h-full"
                    onStateChange={handleYTState}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  A carregar…
                </div>
              )}
            </div>
            {coverVisible && (
              <div className="absolute inset-0 bg-black pointer-events-none" />
            )}
            {/* Mobile player overlay top-right */}
            {current && (
              <div className="absolute top-2 right-2 z-20 sm:hidden">
                <div className="backdrop-blur bg-black/70 border border-border rounded-md shadow-lg p-2 flex items-center gap-2">
                  <div className="relative h-10 w-10 shrink-0">
                    {current.foto ? (
                      <img
                        src={current.foto}
                        alt={current.nome}
                        className="h-10 w-10 rounded object-cover border border-border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-extrabold shadow">
                      {current.numero ?? "-"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">
                      {current.nome}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {current.campeonato || ""}
                    </div>
                    <div className="text-[10px] opacity-90 truncate max-w-[150px]">
                      {current.jogo || ""}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info bar under player (hidden on mobile) */}
        <div className="hidden sm:block w-full bg-secondary border-t border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center gap-6 overflow-x-auto">
            {/* Photo with number overlay */}
            <div className="relative h-20 w-20 shrink-0">
              {current?.foto ? (
                <img
                  src={current.foto}
                  alt={current?.nome ?? "Jogador"}
                  className="h-20 w-20 rounded object-cover border border-border"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-muted" />
              )}
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-extrabold shadow">
                {current?.numero ?? "-"}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-6 min-w-0 mb-[7px]">
              <div className="text-[50px] font-extrabold leading-[40px] truncate max-w-[30vw]">
                {current?.nome || ""}
              </div>
              <div className="min-w-0">
                <div className="text-base md:text-lg text-muted-foreground truncate">
                  {current?.campeonato || ""}
                </div>
                <div className="text-base md:text-lg opacity-90 truncate">
                  {current?.jogo || ""}
                </div>
              </div>
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-4">
              {current?.title && (
                <div className="text-2xl md:text-3xl font-black tracking-tight animate-pulse">
                  {current.title}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <PlaylistMenu
        items={allItems}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelectAll={handleSelectAll}
        onSelectShuffle={handleSelectShuffle}
        onSelectRecent={handleSelectRecent}
        onSelectGroup={handleSelectGroup}
        onSelectVideo={handleSelectVideo}
      />
    </div>
  );
}
