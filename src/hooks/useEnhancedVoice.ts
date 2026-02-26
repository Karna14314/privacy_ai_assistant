import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { VoiceRecordingState } from '../types';
interface EnhancedVoiceState extends VoiceRecordingState {
  isTTSPlaying: boolean;
  ttsQueue: string[];
  sttProvider: 'web-speech' | 'vosk' | 'whisper';
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
}
interface UseEnhancedVoiceReturn {
  voiceState: EnhancedVoiceState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  speakText: (text: string, options?: { interrupt?: boolean; voice?: string }) => Promise<void>;
  stopSpeaking: () => void;
  clearTTSQueue: () => void;
  getAvailableVoices: () => SpeechSynthesisVoice[];
  setVoice: (voice: SpeechSynthesisVoice) => void;
  requestMicrophonePermission: () => Promise<boolean>;
}
export const useEnhancedVoice = (): UseEnhancedVoiceReturn => {
  const { settings, updateVoiceConfig } = useSettingsStore();
  const [voiceState, setVoiceState] = useState<EnhancedVoiceState>({
    isRecording: false,
    isProcessing: false,
    transcription: '',
    confidence: 0,
    error: undefined,
    isTTSPlaying: false,
    ttsQueue: [],
    sttProvider: settings.voiceConfig.voiceProvider,
    availableVoices: [],
    selectedVoice: null,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setVoiceState(prev => ({
        ...prev,
        availableVoices: voices,
        selectedVoice: voices.find(voice => 
          voice.lang.startsWith(settings.voiceConfig.sttLanguage.split('-')[0])
        ) || voices[0] || null
      }));
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [settings.voiceConfig.sttLanguage]);
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setVoiceState(prev => ({
        ...prev,
        error: 'Microphone permission denied. Please allow microphone access.'
      }));
      return false;
    }
  }, []);
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      console.log(' Starting enhanced voice recording...');
      setVoiceState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        transcription: '',
        confidence: 0,
        error: undefined
      }));
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        return;
      }
      switch (settings.voiceConfig.voiceProvider) {
        case 'web-speech':
          await startWebSpeechRecording();
          break;
        case 'vosk':
          await startVoskRecording();
          break;
        case 'whisper':
          await startWhisperRecording();
          break;
        default:
          await startWebSpeechRecording();
      }
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setVoiceState(prev => ({
        ...prev,
        isRecording: false,
        error: `Failed to start recording: ${error}`
      }));
    }
  }, [settings.voiceConfig.voiceProvider]);
  const startWebSpeechRecording = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    speechRecognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.voiceConfig.sttLanguage;
    recognition.onstart = () => {
      console.log('✅ Web Speech recognition started');
    };
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          setVoiceState(prev => ({
            ...prev,
            transcription: finalTranscript,
            confidence: confidence || 0.9
          }));
        } else {
          interimTranscript += transcript;
          setVoiceState(prev => ({
            ...prev,
            transcription: interimTranscript,
            confidence: confidence || 0.5
          }));
        }
      }
    };
    recognition.onerror = (event) => {
      console.error('❌ Web Speech recognition error:', event.error);
      setVoiceState(prev => ({
        ...prev,
        isRecording: false,
        error: `Speech recognition error: ${event.error}`
      }));
    };
    recognition.onend = () => {
      console.log(' Web Speech recognition ended');
      setVoiceState(prev => ({
        ...prev,
        isRecording: false
      }));
    };
    recognition.start();
  }, [settings.voiceConfig.sttLanguage]);
  const startVoskRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const ws = new WebSocket('ws://127.0.0.1:8000/stt/vosk');
      websocketRef.current = ws;
      ws.onopen = () => {
        console.log('✅ Vosk WebSocket connected');
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        mediaRecorder.start(100);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.partial) {
            setVoiceState(prev => ({
              ...prev,
              transcription: data.partial,
              confidence: 0.5
            }));
          } else if (data.text) {
            setVoiceState(prev => ({
              ...prev,
              transcription: data.text,
              confidence: data.confidence || 0.9
            }));
          }
        } catch (error) {
          console.error('❌ Vosk WebSocket message error:', error);
        }
      };
      ws.onerror = (error) => {
        console.error('❌ Vosk WebSocket error:', error);
        setVoiceState(prev => ({
          ...prev,
          isRecording: false,
          error: 'Vosk connection failed. Make sure the Python backend is running.'
        }));
      };
      ws.onclose = () => {
        console.log(' Vosk WebSocket closed');
        stream.getTracks().forEach(track => track.stop());
      };
    } catch (error) {
      console.error('❌ Vosk recording error:', error);
      throw error;
    }
  }, []);
  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1
        }
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioData = Array.from(new Uint8Array(arrayBuffer));
        try {
          setVoiceState(prev => ({ ...prev, isProcessing: true }));
          const result = await invoke<{ text: string; confidence: number }>('transcribe_audio_whisper', {
            audioData
          });
          setVoiceState(prev => ({
            ...prev,
            transcription: result.text,
            confidence: result.confidence,
            isProcessing: false
          }));
        } catch (error) {
          console.error('❌ Whisper transcription error:', error);
          setVoiceState(prev => ({
            ...prev,
            isProcessing: false,
            error: `Whisper transcription failed: ${error}`
          }));
        }
      };
      mediaRecorder.start();
    } catch (error) {
      console.error('❌ Whisper recording error:', error);
      throw error;
    }
  }, []);
  const stopRecording = useCallback(async (): Promise<void> => {
    console.log('⏹️ Stopping voice recording...');
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setVoiceState(prev => ({
      ...prev,
      isRecording: false
    }));
  }, []);
  const speakText = useCallback(async (
    text: string, 
    options?: { interrupt?: boolean; voice?: string }
  ): Promise<void> => {
    if (!settings.voiceConfig.ttsEnabled) {
      console.log(' TTS is disabled');
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        if (options?.interrupt) {
          speechSynthesis.cancel();
          ttsQueueRef.current = [];
        }
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesisRef.current = utterance;
        if (voiceState.selectedVoice) {
          utterance.voice = voiceState.selectedVoice;
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onstart = () => {
          console.log(' TTS started');
          setVoiceState(prev => ({ ...prev, isTTSPlaying: true }));
        };
        utterance.onend = () => {
          console.log(' TTS ended');
          setVoiceState(prev => ({ ...prev, isTTSPlaying: false }));
          resolve();
        };
        utterance.onerror = (event) => {
          console.error('❌ TTS error:', event.error);
          setVoiceState(prev => ({ ...prev, isTTSPlaying: false }));
          reject(new Error(`TTS error: ${event.error}`));
        };
        speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('❌ TTS failed:', error);
        reject(error);
      }
    });
  }, [settings.voiceConfig.ttsEnabled, voiceState.selectedVoice]);
  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    ttsQueueRef.current = [];
    setVoiceState(prev => ({ ...prev, isTTSPlaying: false, ttsQueue: [] }));
  }, []);
  const clearTTSQueue = useCallback(() => {
    ttsQueueRef.current = [];
    setVoiceState(prev => ({ ...prev, ttsQueue: [] }));
  }, []);
  const getAvailableVoices = useCallback((): SpeechSynthesisVoice[] => {
    return voiceState.availableVoices;
  }, [voiceState.availableVoices]);
  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setVoiceState(prev => ({ ...prev, selectedVoice: voice }));
    updateVoiceConfig({ ttsVoice: voice.name });
  }, [updateVoiceConfig]);
  useEffect(() => {
    return () => {
      stopRecording();
      stopSpeaking();
    };
  }, [stopRecording, stopSpeaking]);
  return {
    voiceState,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    clearTTSQueue,
    getAvailableVoices,
    setVoice,
    requestMicrophonePermission,
  };
};
