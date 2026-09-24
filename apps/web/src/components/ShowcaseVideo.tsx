import { useEffect, useRef, useState } from 'react';

interface ShowcaseVideoProps {
  src: string;
  poster?: string;
  label: string;
  /** Autoplay muted when scrolled into view (unless prefers-reduced-motion). */
  autoplay?: boolean;
  /** Loop while autoplaying (e.g. a launch reel). */
  loop?: boolean;
  className?: string;
}

/**
 * Tight embed: lazy-loads the source only when the frame nears the viewport,
 * autoplays muted on scroll-into-view, and respects prefers-reduced-motion
 * (falling back to a poster + play overlay). Native controls remain available.
 */
export default function ShowcaseVideo({ src, poster, label, autoplay = false, loop = false, className = '' }: ShowcaseVideoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Lazy-load the source once the frame is within ~400px of the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoaded(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Track visibility for autoplay; respect reduced-motion.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Autoplay muted while in view; pause when scrolled away.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay || reducedMotion || !loaded) return;
    if (inView) {
      const p = v.play();
      p?.catch(() => undefined);
    } else {
      v.pause();
    }
  }, [inView, autoplay, reducedMotion, loaded]);

  return (
    <div ref={wrapRef} className={`showcase-video ${className}${inView ? ' in-view' : ''}`}>
      {loaded ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          loop={loop}
          muted={autoplay}
          playsInline
          preload={autoplay ? 'auto' : 'metadata'}
          aria-label={label}
        />
      ) : (
        <div className="showcase-video-skeleton" aria-hidden="true" />
      )}
    </div>
  );
}