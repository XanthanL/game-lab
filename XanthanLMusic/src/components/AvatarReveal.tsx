import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Avatar reveal — the "signal source" materializing from foam.
 * Plays once when scrolled into view (muted by default), holds the final
 * frame, and offers a tasteful replay + optional sound toggle. Falls back
 * gracefully to the static mask image if the video is missing.
 */
export function AvatarReveal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const { t } = useTranslation();

  // Replay once each time it scrolls back into view, but never auto-replay
  // after the first full playthrough (hold the final frame instead).
  const isInView = useInView(containerRef, {
    once: false,
    margin: '-15% 0px -15% 0px',
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasError) return;
    if (isInView && !hasEnded) {
      video.play().catch(() => {});
    } else if (!isInView) {
      video.pause();
    }
  }, [isInView, hasEnded, hasError]);

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setHasEnded(false);
    video.play().catch(() => {});
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
    // If the visitor unmutes after it ended, replay so they actually hear it.
    if (!next && hasEnded) handleReplay();
  };

  return (
    <div ref={containerRef} className="relative group">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden">
        {hasError ? (
          <img
            src="images/about-mask.jpg"
            alt="XanthanL — behind the mask"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster="images/about-mask.jpg"
            onEnded={() => setHasEnded(true)}
            onError={() => setHasError(true)}
          >
            <source src="videos/manwithbaboo.mp4" type="video/mp4" />
          </video>
        )}

        {/* Gradient overlays — match the original About image treatment */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--about-accent)]/10 via-transparent to-[var(--neon-cyan)]/10 pointer-events-none" />
        {/* Inner vignette so the figure drifts into the dark */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 100px rgba(0,0,0,0.7)' }}
        />

        {/* Signal indicator — ties the video to the "Signal Source" theme */}
        <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full bg-[var(--about-accent)] shadow-[0_0_8px_var(--about-accent)]"
          />
          <span className="font-['Orbitron'] text-[9px] uppercase tracking-[0.3em] text-white/50">
            {hasEnded ? t('about.signalLocked') : t('about.materializing')}
          </span>
        </div>
      </div>

      {/* Sound toggle — subtle, hover-revealed */}
      {!hasError && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? t('about.unmute') : t('about.mute')}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-[var(--about-accent)] hover:border-[var(--about-accent)] transition-colors"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      )}

      {/* Replay — appears once the materialization completes */}
      <AnimatePresence>
        {hasEnded && !hasError && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={handleReplay}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-[var(--about-accent)] hover:border-[var(--about-accent)] transition-colors"
          >
            <RotateCcw size={12} />
            <span className="font-['Orbitron'] text-[9px] uppercase tracking-[0.25em]">
              {t('about.replay')}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
