import { useEffect, useRef, useState } from "react";

interface YouTubePlayerProps {
  videoId: string | null;
  startSeconds?: number;
  className?: string;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export default function YouTubePlayer({ videoId, startSeconds = 0, className, onReady, onStateChange }: YouTubePlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load YT Iframe API once
  useEffect(() => {
    setMounted(true);
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  // Create player when API ready
  useEffect(() => {
    if (!apiReady || !wrapperRef.current || playerRef.current) return;
    // Create an inner mount node we fully control
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    wrapperRef.current.appendChild(mount);
    mountNodeRef.current = mount;

    playerRef.current = new window.YT.Player(mount, {
      height: "100%",
      width: "100%",
      videoId: videoId ?? undefined,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,
        playsinline: 1,
        showinfo: 0,
        start: Math.max(0, Math.floor(startSeconds || 0)),
      },
      events: {
        onReady: () => {
          try {
            playerRef.current?.mute();
            if (videoId) playerRef.current?.loadVideoById({ videoId, startSeconds: Math.max(0, Math.floor(startSeconds || 0)) });
          } catch {}
          onReady?.();
        },
        onStateChange: (e: any) => {
          onStateChange?.(e?.data);
        },
      },
    });

    return () => {
      try {
        playerRef.current?.stopVideo?.();
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      // Safely remove our mount node if still present
      const wrap = wrapperRef.current;
      const mountNode = mountNodeRef.current;
      if (wrap && mountNode && mountNode.parentNode === wrap) {
        try { wrap.removeChild(mountNode); } catch {}
      }
      mountNodeRef.current = null;
    };
  }, [apiReady]);

  // Handle video/start changes
  useEffect(() => {
    if (!mounted) return;
    const player = playerRef.current;
    if (!player || !videoId) return;
    try {
      player.loadVideoById({ videoId, startSeconds: Math.max(0, Math.floor(startSeconds || 0)) });
      player.mute();
      player.playVideo();
    } catch {}
  }, [videoId, startSeconds, mounted]);

  return <div ref={wrapperRef} className={className} />;
}
