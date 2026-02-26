import { useState, useCallback, useRef, useEffect } from 'react';
interface StreamingTTSState {
  isPlaying: boolean;
  isProcessing: boolean;
  error: string | null;
  currentText: string | null;
  queuedText: string[];
  playbackProgress: number;
}
interface UseStreamingTTSReturn {
  ttsState: StreamingTTSState;
  speakStreaming: (text: string, voice?: string, speed?: number) => Promise<void>;
  addToQueue: (text: string) => void;
  stop: () => void;
  clearQueue: () => void;
  isSupported: boolean;
}
const TTS_BACKEND_URL = 'http://127.0.0.1:8000/tts/synthesize';
const CHUNK_SIZE = 50;
export const useStreamingTTS = (): UseStreamingTTSReturn => {
  const [ttsState, setTTSState] = useState<StreamingTTSState>({
    isPlaying: false,
    isProcessing: false,
    error: null,
    currentText: null,
    queuedText: [],
    playbackProgress: 0,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingQueueRef = useRef<boolean>(false);
  const isSupported = typeof Audio !== 'undefined';
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    processingQueueRef.current = false;
    setTTSState(prev => ({
      ...prev,
      isPlaying: false,
      isProcessing: false,
      currentText: null,
      queuedText: [],
      playbackProgress: 0
    }));
  }, []);
  const clearQueue = useCallback(() => {
    setTTSState(prev => ({
      ...prev,
      queuedText: []
    }));
  }, []);
  const splitTextIntoChunks = useCallback((text: string): string[] => {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      if (sentence.length <= CHUNK_SIZE) {
        chunks.push(sentence.trim() + '.');
      } else {
        const words = sentence.split(/[,\s]+/);
        let currentChunk = '';
        for (const word of words) {
          if ((currentChunk + ' ' + word).length <= CHUNK_SIZE) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim() + ',');
              currentChunk = word;
            } else {
              chunks.push(word.substring(0, CHUNK_SIZE));
              currentChunk = word.substring(CHUNK_SIZE);
            }
          }
        }
        if (currentChunk) {
          chunks.push(currentChunk.trim() + '.');
        }
      }
    }
    return chunks.filter(chunk => chunk.trim().length > 0);
  }, []);
  const synthesizeChunk = useCallback(async (text: string, voice: string = 'en', speed: number = 1.0): Promise<HTMLAudioElement> => {
    console.log(' Synthesizing chunk:', text.substring(0, 30) + '...');
    const response = await fetch(TTS_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
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
    const audioData = atob(data.audio_data);
    const audioArray = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      audioArray[i] = audioData.charCodeAt(i);
    }
    const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    return new Promise((resolve, reject) => {
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to load audio'));
      };
    });
  }, []);
  const processQueue = useCallback(async (voice: string = 'en', speed: number = 1.0) => {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;
    try {
      while (ttsState.queuedText.length > 0) {
        const textToSpeak = ttsState.queuedText[0];
        setTTSState(prev => ({
          ...prev,
          isProcessing: true,
          currentText: textToSpeak
        }));
        try {
          const audio = await synthesizeChunk(textToSpeak, voice, speed);
          audioRef.current = audio;
          audio.onended = () => {
            console.log(' Chunk playback completed');
            URL.revokeObjectURL(audio.src);
            audioRef.current = null;
            setTTSState(prev => ({
              ...prev,
              queuedText: prev.queuedText.slice(1),
              playbackProgress: prev.playbackProgress + 1
            }));
          };
          audio.onerror = (error) => {
            console.error('❌ Chunk playback error:', error);
            URL.revokeObjectURL(audio.src);
            audioRef.current = null;
            setTTSState(prev => ({
              ...prev,
              error: 'Audio playback failed',
              queuedText: prev.queuedText.slice(1)
            }));
          };
          setTTSState(prev => ({
            ...prev,
            isPlaying: true,
            isProcessing: false
          }));
          await audio.play();
          await new Promise<void>((resolve) => {
            const checkEnded = () => {
              if (audio.ended || audio.paused) {
                resolve();
              } else {
                setTimeout(checkEnded, 100);
              }
            };
            checkEnded();
          });
        } catch (chunkError) {
          console.error('❌ Failed to process chunk:', chunkError);
          setTTSState(prev => ({
            ...prev,
            queuedText: prev.queuedText.slice(1),
            error: `Failed to synthesize: ${chunkError}`
          }));
        }
      }
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        isProcessing: false,
        currentText: null,
        playbackProgress: 0
      }));
    } catch (error) {
      console.error('❌ Queue processing error:', error);
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Queue processing failed'
      }));
    } finally {
      processingQueueRef.current = false;
    }
  }, [ttsState.queuedText, synthesizeChunk]);
  const addToQueue = useCallback((text: string) => {
    const chunks = splitTextIntoChunks(text);
    setTTSState(prev => ({
      ...prev,
      queuedText: [...prev.queuedText, ...chunks],
      error: null
    }));
  }, [splitTextIntoChunks]);
  const speakStreaming = useCallback(async (text: string, voice: string = 'en', speed: number = 1.0): Promise<void> => {
    try {
      stop();
      addToQueue(text);
      await processQueue(voice, speed);
    } catch (error) {
      console.error('❌ Streaming TTS error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming TTS error';
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        isProcessing: false,
        error: errorMessage,
        currentText: null
      }));
    }
  }, [stop, addToQueue, processQueue]);
  useEffect(() => {
    if (ttsState.queuedText.length > 0 && !processingQueueRef.current && !ttsState.isPlaying) {
      processQueue();
    }
  }, [ttsState.queuedText, ttsState.isPlaying, processQueue]);
  return {
    ttsState,
    speakStreaming,
    addToQueue,
    stop,
    clearQueue,
    isSupported
  };
};
