import { useState, useCallback, useRef } from 'react';
interface TTSState {
  isPlaying: boolean;
  error: string | null;
  currentText: string | null;
}
interface UseTTSReturn {
  ttsState: TTSState;
  speak: (text: string, voice?: string, speed?: number) => Promise<void>;
  stop: () => void;
  isSupported: boolean;
}
const TTS_BACKEND_URL = 'http://127.0.0.1:8000/tts/synthesize';
export const useTTS = (): UseTTSReturn => {
  const [ttsState, setTTSState] = useState<TTSState>({
    isPlaying: false,
    error: null,
    currentText: null,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSupported = typeof Audio !== 'undefined';
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setTTSState(prev => ({
      ...prev,
      isPlaying: false,
      currentText: null
    }));
  }, []);
  const speak = useCallback(async (text: string, voice: string = 'en', speed: number = 1.0): Promise<void> => {
    try {
      stop();
      setTTSState(prev => ({
        ...prev,
        isPlaying: true,
        error: null,
        currentText: text
      }));
      console.log(' Requesting TTS synthesis...');
      const response = await fetch(TTS_BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          speed
        })
      });
      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'TTS synthesis failed');
      }
      if (!data.audio_data) {
        throw new Error('No audio data received from TTS service');
      }
      console.log('✅ TTS synthesis successful, playing audio...');
      const audioData = atob(data.audio_data);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        console.log(' TTS playback completed');
        URL.revokeObjectURL(audioUrl);
        setTTSState(prev => ({
          ...prev,
          isPlaying: false,
          currentText: null
        }));
        audioRef.current = null;
      };
      audio.onerror = (error) => {
        console.error('❌ TTS playback error:', error);
        URL.revokeObjectURL(audioUrl);
        setTTSState(prev => ({
          ...prev,
          isPlaying: false,
          error: 'Audio playback failed',
          currentText: null
        }));
        audioRef.current = null;
      };
      await audio.play();
    } catch (error) {
      console.error('❌ TTS error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown TTS error';
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        error: errorMessage,
        currentText: null
      }));
    }
  }, [stop]);
  return {
    ttsState,
    speak,
    stop,
    isSupported
  };
};
