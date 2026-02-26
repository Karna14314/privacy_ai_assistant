import { useState, useRef, useCallback, useEffect } from 'react';
interface STTResult {
  type: 'partial' | 'final' | 'error' | 'ping' | 'ready' | 'heartbeat';
  text: string;
  timestamp?: number;
}
interface UseRealtimeSTTReturn {
  isRecording: boolean;
  isConnected: boolean;
  partialText: string;
  finalText: string;
  error: string | null;
  micPermission: 'prompt' | 'granted' | 'denied' | 'checking';
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearResults: () => void;
  requestMicPermission: () => Promise<boolean>;
}
const PYTHON_BACKEND_WS_URL = 'ws://127.0.0.1:8000/stt/stream';
export const useRealtimeSTT = (): UseRealtimeSTTReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('prompt');
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  const clearResults = useCallback(() => {
    setPartialText('');
    setFinalText('');
    setError(null);
  }, []);
  const convertFloat32ToInt16 = useCallback((float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const clampedValue = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = clampedValue * 32767;
    }
    return int16Array;
  }, []);
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      setMicPermission('checking');
      setError(null);
      console.log(' Requesting microphone permission...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      }
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('Microphone access requires a secure connection (HTTPS). Please use HTTPS or localhost.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000, min: 8000, max: 48000 },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      source.disconnect();
      audioContext.close();
      stream.getTracks().forEach(track => track.stop());
      setMicPermission('granted');
      console.log('✅ Microphone permission granted and tested');
      return true;
    } catch (error: any) {
      console.error('❌ Microphone permission error:', error);
      setMicPermission('denied');
      let errorMessage = 'Microphone access denied. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please click "Allow" when prompted for microphone access, or enable microphone permissions in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Microphone does not support the required audio settings.';
      } else {
        errorMessage += `Error: ${error.message}`;
      }
      setError(errorMessage);
      return false;
    }
  }, []);
  const stopAudioCapture = useCallback(() => {
    console.log(' Stopping audio capture...');
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(' Stopped microphone track');
      });
      mediaStreamRef.current = null;
    }
  }, []);
  const startAudioCapture = useCallback(async () => {
    try {
      console.log(' Starting audio capture...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000, min: 8000, max: 48000 },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) {
        throw new Error('No audio tracks found in media stream');
      }
      const track = tracks[0];
      if (!track.enabled) {
        throw new Error('Audio track is disabled');
      }
      console.log(' Audio track settings:', track.getSettings());
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000
        });
        audioContextRef.current = audioContext;
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      } catch (contextError) {
        throw new Error(`Failed to create audio context: ${contextError}`);
      }
      let source: MediaStreamAudioSourceNode;
      try {
        source = audioContextRef.current.createMediaStreamSource(stream);
      } catch (sourceError) {
        throw new Error(`Failed to create audio source: ${sourceError}`);
      }
      const bufferSize = 4096;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!isRecording || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        try {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          const hasAudio = inputBuffer.some(sample => Math.abs(sample) > 0.001);
          if (!hasAudio) {
            return;
          }
          const pcmData = convertFloat32ToInt16(inputBuffer);
          if (websocketRef.current.readyState === WebSocket.OPEN) {
            websocketRef.current.send(pcmData.buffer);
          }
        } catch (error) {
          console.error('❌ Failed to process audio data:', error);
          setError('Audio processing error occurred');
        }
      };
      try {
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        console.log('✅ Audio capture started with buffer size:', bufferSize);
      } catch (connectionError) {
        throw new Error(`Failed to connect audio nodes: ${connectionError}`);
      }
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      setError(`Failed to start audio capture: ${error}`);
      throw error;
    }
  }, [isRecording, convertFloat32ToInt16]);
  const disconnect = useCallback(() => {
    console.log(' Disconnecting...');
    stopAudioCapture();
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [stopAudioCapture]);
  const connect = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(' Connecting to Python backend WebSocket...');
        if (!window.WebSocket) {
          throw new Error('WebSocket is not supported in this browser');
        }
        const ws = new WebSocket(PYTHON_BACKEND_WS_URL);
        const connectionTimeout = setTimeout(() => {
          console.error('❌ WebSocket connection timeout');
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
          const errorMsg = 'Connection timeout. Please ensure:\n1. Python backend is running on port 8000\n2. No firewall is blocking the connection\n3. The STT service is properly initialized';
          setError(errorMsg);
          reject(new Error('Connection timeout'));
        }, 15000);
        ws.onopen = () => {
          console.log('✅ WebSocket connected to Python backend');
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          setError(null);
          reconnectAttempts.current = 0;
          websocketRef.current = ws;
          resolve();
        };
        ws.onmessage = (event) => {
          try {
            let data: string;
            if (typeof event.data === 'string') {
              data = event.data;
            } else {
              data = new TextDecoder().decode(event.data);
            }
            const result: STTResult = JSON.parse(data);
            console.log(' STT result received:', result);
            if (result.type === 'partial') {
              setPartialText(result.text);
              console.log(' Partial transcription:', result.text);
            } else if (result.type === 'final') {
              setFinalText(prev => {
                const newText = prev + (prev ? ' ' : '') + result.text;
                console.log(' Final transcription updated:', newText);
                return newText;
              });
              setPartialText('');
            } else if (result.type === 'error') {
              console.error('❌ STT error from backend:', result.text);
              setError(result.text || 'STT processing error occurred');
            } else if (result.type === 'ping') {
              console.debug(' Received ping, sending pong');
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                }
              } catch (pongError) {
                console.error('❌ Failed to send pong:', pongError);
              }
            } else if (result.type === 'ready') {
              console.log('✅ STT WebSocket ready for audio streaming');
              setError(null);
            } else if (result.type === 'heartbeat') {
              console.debug(' Heartbeat received - connection alive');
            } else {
              console.warn('⚠️ Unknown message type received:', result.type);
            }
          } catch (e) {
            console.error('❌ Failed to parse STT result:', e, 'Raw data:', event.data);
            setError('Failed to parse transcription result. The backend may be sending invalid data.');
          }
        };
        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          clearTimeout(connectionTimeout);
          setError('WebSocket connection failed - please check if the backend server is running on port 8000');
          reject(new Error('WebSocket connection failed'));
        };
        ws.onclose = (event) => {
          console.log(' WebSocket closed:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          setIsConnected(false);
          setIsRecording(false);
          websocketRef.current = null;
          const wasCleanClose = event.code === 1000;
          const shouldReconnect = !wasCleanClose && reconnectAttempts.current < maxReconnectAttempts;
          if (shouldReconnect) {
            reconnectAttempts.current++;
            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
            console.log(` Connection lost (code: ${event.code}). Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
            setError(`Connection lost. Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(' Attempting reconnection...');
              connect().catch((error) => {
                console.error('❌ Reconnection failed:', error);
                if (reconnectAttempts.current >= maxReconnectAttempts) {
                  setError('Failed to reconnect to STT service after multiple attempts. Please refresh the page.');
                }
              });
            }, backoffDelay);
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            setError('Failed to reconnect to STT service after multiple attempts. Please refresh the page.');
          } else if (wasCleanClose) {
            console.log('✅ WebSocket closed cleanly');
          }
        };
      } catch (e) {
        console.error('❌ Failed to create WebSocket:', e);
        setError('Failed to create WebSocket connection');
        reject(e);
      }
    });
  }, []);
  const startRecording = useCallback(async () => {
    try {
      console.log(' Starting real-time STT recording...');
      clearResults();
      if (micPermission !== 'granted') {
        const hasPermission = await requestMicPermission();
        if (!hasPermission) {
          return;
        }
      }
      if (!isConnected) {
        await connect();
      }
      await startAudioCapture();
      setIsRecording(true);
      console.log('✅ Real-time STT recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setError(`Failed to start recording: ${error}`);
      setIsRecording(false);
      stopAudioCapture();
    }
  }, [isConnected, micPermission, connect, clearResults, requestMicPermission, startAudioCapture, stopAudioCapture]);
  const stopRecording = useCallback(() => {
    console.log('⏹️ Stopping real-time STT recording...');
    stopAudioCapture();
    if (websocketRef.current && isConnected) {
      try {
        websocketRef.current.send(JSON.stringify({ action: 'stop' }));
      } catch (error) {
        console.error('❌ Failed to send stop command:', error);
      }
    }
    setIsRecording(false);
    console.log('✅ Real-time STT recording stopped');
  }, [isConnected, stopAudioCapture]);
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  return {
    isRecording,
    isConnected,
    partialText,
    finalText,
    error,
    micPermission,
    startRecording,
    stopRecording,
    clearResults,
    requestMicPermission,
  };
};
