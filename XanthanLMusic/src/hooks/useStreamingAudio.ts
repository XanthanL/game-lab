import { useRef, useState, useCallback, useEffect } from 'react';

interface StreamingState {
  isBuffering: boolean;
  bufferProgress: number;
  isReady: boolean;
  error: string | null;
}

interface UseStreamingAudioReturn {
  streamingState: StreamingState;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  loadSong: (src: string) => void;
  reset: () => void;
  setOnEnded: (callback: () => void) => void;
}

// 网络重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function useStreamingAudio(): UseStreamingAudioReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSrcRef = useRef<string>('');
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEndedRef = useRef<(() => void) | null>(null);

  const [streamingState, setStreamingState] = useState<StreamingState>({
    isBuffering: false,
    bufferProgress: 0,
    isReady: false,
    error: null,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 初始化 audio 元素
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    // 监听播放进度
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    // 监听缓冲进度
    const handleProgress = () => {
      if (!audio.duration || audio.buffered.length === 0) return;
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const progress = (bufferedEnd / audio.duration) * 100;
      setStreamingState((prev) => ({
        ...prev,
        bufferProgress: Math.min(progress, 100),
        isBuffering: bufferedEnd <= audio.currentTime + 0.5 && !audio.paused,
      }));
    };

    // 监听等待事件（缓冲不足）
    const handleWaiting = () => {
      setStreamingState((prev) => ({
        ...prev,
        isBuffering: true,
        error: null,
      }));
    };

    // 监听播放事件
    const handlePlaying = () => {
      setStreamingState((prev) => ({
        ...prev,
        isBuffering: false,
        error: null,
      }));
      retryCountRef.current = 0;
    };

    // 监听元数据加载
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setStreamingState((prev) => ({
        ...prev,
        isReady: true,
        isBuffering: false,
      }));
    };

    // 监听错误
    const handleError = () => {
      const error = audio.error;
      if (!error) return;

      // MEDIA_ERR_NETWORK (3) 或 MEDIA_ERR_SRC_NOT_SUPPORTED (4) - 尝试重试
      if (error.code === 3 || error.code === 4) {
        handleNetworkError();
      } else {
        setStreamingState((prev) => ({
          ...prev,
          isBuffering: false,
          error: `Playback error (code: ${error.code})`,
        }));
      }
    };

    // 监听播放结束
    const handleEnded = () => {
      onEndedRef.current?.();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      audio.src = '';
      audio.load();
    };
  }, []);

  // 网络错误重试
  const handleNetworkError = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      setStreamingState((prev) => ({
        ...prev,
        isBuffering: false,
        error: 'Network error: failed to load audio after multiple retries',
      }));
      return;
    }

    retryCountRef.current++;
    const delay = RETRY_DELAY_MS * retryCountRef.current;

    setStreamingState((prev) => ({
      ...prev,
      error: `Network error, retrying (${retryCountRef.current}/${MAX_RETRIES})...`,
    }));

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      const audio = audioRef.current;
      if (!audio || !currentSrcRef.current) return;

      audio.src = currentSrcRef.current;
      audio.load();
    }, delay);
  }, []);

  // 加载歌曲
  const loadSong = useCallback((src: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    currentSrcRef.current = src;
    retryCountRef.current = 0;
    setCurrentTime(0);

    setStreamingState({
      isBuffering: true,
      bufferProgress: 0,
      isReady: false,
      error: null,
    });

    audio.src = src;
    audio.load();
  }, []);

  // 播放
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    try {
      await audio.play();
    } catch {
      setStreamingState((prev) => ({
        ...prev,
        isBuffering: true,
        error: 'Waiting for buffer...',
      }));
    }
  }, []);

  // 暂停
  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // 跳转
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    audio.currentTime = time;
    setCurrentTime(time);

    // 检查目标位置是否在已缓冲范围内
    let isBuffered = false;
    for (let i = 0; i < audio.buffered.length; i++) {
      if (time >= audio.buffered.start(i) && time <= audio.buffered.end(i)) {
        isBuffered = true;
        break;
      }
    }

    if (!isBuffered) {
      setStreamingState((prev) => ({
        ...prev,
        isBuffering: true,
      }));
    }
  }, []);

  // 设置音量
  const setVolume = useCallback((v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  // 重置
  const reset = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    audio.pause();
    audio.src = '';
    currentSrcRef.current = '';
    retryCountRef.current = 0;
    setCurrentTime(0);
    setDuration(0);

    setStreamingState({
      isBuffering: false,
      bufferProgress: 0,
      isReady: false,
      error: null,
    });
  }, []);

  // 注册播放结束回调
  const setOnEnded = useCallback((callback: () => void) => {
    onEndedRef.current = callback;
  }, []);

  return {
    streamingState,
    currentTime,
    duration,
    play,
    pause,
    seek,
    setVolume,
    loadSong,
    reset,
    setOnEnded,
  };
}
