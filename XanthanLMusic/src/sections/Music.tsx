import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2 } from 'lucide-react';
import { ScrollReveal } from '../components/ScrollReveal';
import { XANTHANL_PLAYLIST } from '../config/music';
import { useStreamingAudio } from '../hooks/useStreamingAudio';
import { useTranslation } from '../hooks/useTranslation';

export function Music() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);

  const {
    streamingState,
    currentTime,
    duration,
    play: streamPlay,
    pause: streamPause,
    seek: streamSeek,
    setVolume: streamSetVolume,
    loadSong,
    setOnEnded,
  } = useStreamingAudio();

  const currentSong = XANTHANL_PLAYLIST[currentIndex];
  const prevSongRef = useRef<string>('');
  const { t } = useTranslation();

  // 注册播放结束回调
  useEffect(() => {
    setOnEnded(() => {
      setCurrentIndex((prev) => (prev + 1) % XANTHANL_PLAYLIST.length);
    });
  }, [setOnEnded]);

  // 加载歌曲
  useEffect(() => {
    if (currentSong.src !== prevSongRef.current) {
      prevSongRef.current = currentSong.src;
      loadSong(currentSong.src);
    }
  }, [currentSong.src, loadSong]);

  // 自动播放切换后
  useEffect(() => {
    if (isPlaying && streamingState.isReady && !streamingState.isBuffering) {
      streamPlay().catch(() => {});
    }
  }, [currentIndex, isPlaying, streamingState.isReady, streamingState.isBuffering, streamPlay]);

  const togglePlay = () => {
    if (streamingState.isBuffering && !streamingState.isReady) return;
    if (isPlaying) {
      streamPause();
    } else {
      streamPlay().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const playSong = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % XANTHANL_PLAYLIST.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + XANTHANL_PLAYLIST.length) % XANTHANL_PLAYLIST.length);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    streamSeek(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolumeState(v);
    streamSetVolume(v);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section id="music" className="section-padding relative">
      <div className="container-custom">
        {/* Section header */}
        <ScrollReveal className="mb-16">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-['Orbitron'] text-4xl md:text-5xl lg:text-6xl font-bold">
                <span className="neon-text-glow">{t('music.title')}</span>
              </h2>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Column: Player Interface */}
          <ScrollReveal direction="left">
            <div className="relative group p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--music-accent)]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10 flex flex-col gap-8">
                {/* Album Cover Area */}
                <div className="relative aspect-square w-full max-w-[320px] mx-auto overflow-hidden rounded-2xl shadow-2xl bg-neutral-900 border border-white/5">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentSong.id}
                      src={currentSong.cover}
                      alt={currentSong.title}
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.5 }}
                      className="w-full h-full object-cover"
                    />
                  </AnimatePresence>
                  
                  {/* Playing State Overlay */}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <motion.div
                      animate={isPlaying ? { rotate: 360 } : {}}
                      transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                      className={`w-3/4 h-3/4 rounded-full border border-white/10 flex items-center justify-center p-4 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
                    >
                      <div className="w-full h-full rounded-full border-4 border-white/5 border-dashed" />
                    </motion.div>
                  </div>
                </div>

                {/* Song Info */}
                <div className="text-center space-y-2">
                  <h3 className="font-['Orbitron'] text-2xl font-bold tracking-wider text-white">
                    {currentSong.title}
                  </h3>
                  <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-light">
                    {currentSong.artist}
                  </p>
                </div>

                {/* Controls */}
                <div className="space-y-6">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="relative h-1 rounded-lg bg-white/10 overflow-hidden">
                      {/* Buffered progress */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-[var(--neon-purple)]/40 to-[var(--neon-pink)]/40"
                        style={{ width: `${streamingState.bufferProgress}%` }}
                      />
                      {/* Playback progress */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-pink)]"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-['Orbitron'] text-white/40 tracking-widest">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Main Buttons */}
                  <div className="flex items-center justify-center gap-8">
                    <button
                      onClick={handlePrev}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <SkipBack size={24} />
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      disabled={streamingState.isBuffering && !streamingState.isReady}
                      className="w-16 h-16 rounded-full bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-pink)] flex items-center justify-center shadow-[0_0_20px_rgba(176,38,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {streamingState.isBuffering && !streamingState.isReady ? (
                        <Loader2 size={28} className="text-white animate-spin" />
                      ) : isPlaying ? (
                        <Pause size={28} className="text-white" fill="white" />
                      ) : (
                        <Play size={28} className="text-white ml-1" fill="white" />
                      )}
                    </motion.button>

                    <button
                      onClick={handleNext}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <SkipForward size={24} />
                    </button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-3 justify-center text-white/40">
                    <Volume2 size={14} />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white/40 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  {/* Buffering indicator */}
                  {streamingState.isBuffering && streamingState.isReady && (
                    <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                      <Loader2 size={12} className="animate-spin" />
                      <span>{t('music.buffering')}... {Math.round(streamingState.bufferProgress)}%</span>
                    </div>
                  )}

                  {/* Error message */}
                  {streamingState.error && (
                    <div className="text-center text-xs text-red-400">
                      {t('music.networkError')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right Column: Intro & Tracklist */}
          <ScrollReveal direction="right" className="space-y-8">
            <div className="space-y-4">
              <h3 className="font-['Orbitron'] text-2xl font-bold text-white">{t('music.albumTitle')}</h3>
              <p className="text-white/60 max-w-md leading-relaxed">
                {t('music.albumDesc')}
              </p>
              <p className="text-white/40 text-sm italic">
                {t('music.albumMeta')}
              </p>
            </div>

            <div className="space-y-2 mt-8">
              {XANTHANL_PLAYLIST.map((song, index) => (
                <motion.div
                  key={song.id}
                  whileHover={{ x: 10 }}
                  onClick={() => playSong(index)}
                  className={`group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                    currentIndex === index
                      ? 'bg-white/10 border-l-2 border-l-[var(--music-accent)] border-y-transparent border-r-transparent'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className={`font-['Orbitron'] text-xs w-6 ${
                    currentIndex === index ? 'text-[var(--music-accent)]' : 'text-white/20'
                  }`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium tracking-wide transition-colors ${
                      currentIndex === index ? 'text-white' : 'text-white/70 group-hover:text-white'
                    }`}>
                      {song.title}
                    </h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{song.artist}</p>
                  </div>
                  {currentIndex === index && isPlaying && (
                    <div className="flex gap-1 items-end h-3">
                      {[1, 2, 3].map(i => (
                        <motion.div
                          key={i}
                          animate={{ height: [4, 12, 4] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                          className="w-0.5 bg-[var(--music-accent)]"
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[var(--music-accent)]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
    </section>
  );
}
