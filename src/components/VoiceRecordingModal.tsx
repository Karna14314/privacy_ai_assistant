import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Square, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
interface VoiceRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}
export const VoiceRecordingModal: React.FC<VoiceRecordingModalProps> = ({
  isOpen,
  onClose,
  onTranscriptionComplete,
  onRecordingStateChange
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'starting' | 'recording' | 'processing' | 'complete' | 'error'>('idle');
  const [partialTranscription, setPartialTranscription] = useState('');
  const [finalTranscription, setFinalTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (isOpen) {
      resetState();
    } else {
      cleanup();
    }
  }, [isOpen]);
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);
  const resetState = () => {
    setIsRecording(false);
    setRecordingState('idle');
    setPartialTranscription('');
    setFinalTranscription('');
    setError(null);
    setAudioLevel(0);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };
  const cleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    resetState();
  };
  const handleStart = async () => {
    try {
      setError(null);
      setRecordingState('starting');
      setPartialTranscription(' Requesting microphone access...');
      console.log(' Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000, min: 8000, max: 48000 },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      setupAudioAnalysis(stream);
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      if (!mimeType) {
        throw new Error('No supported audio MIME type found');
      }
      console.log(' Using MIME type:', mimeType);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000
      });
      mimeTypeRef.current = mimeType;
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(' Audio chunk received:', event.data.size, 'bytes');
        }
      };
      mediaRecorder.onstop = async () => {
        console.log('⏹️ MediaRecorder stopped, using Vosk for transcription...');
        await processWithVosk();
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingState('recording');
      setPartialTranscription(' Recording... Speak now!');
      onRecordingStateChange?.(true);
      recordingTimeoutRef.current = setTimeout(() => {
        handleStop();
      }, 30000);
      console.log('✅ Recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setRecordingState('error');
      setPartialTranscription('❌ Failed to access microphone. Please check permissions.');
    }
  };
  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('⏹️ Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingState('processing');
      setPartialTranscription(' Processing audio...');
      onRecordingStateChange?.(false);
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    }
  };
  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      microphone.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(Math.min(100, (average / 255) * 100));
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
    } catch (error) {
      console.warn('⚠️ Audio analysis setup failed:', error);
    }
  };
  const processWithVosk = async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        throw new Error('No audio data recorded');
      }
      console.log(' Processing with Vosk STT...');
      setPartialTranscription(' Transcribing audio...');
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mimeTypeRef.current || 'audio/webm' 
      });
      console.log(' Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${getFileExtension(mimeTypeRef.current)}`);
      const response = await fetch('http://127.0.0.1:8000/stt/transcribe', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      console.log(' Vosk transcription result:', result);
      if (result.success && result.text && result.text.trim()) {
        const transcribedText = result.text.trim();
        setFinalTranscription(transcribedText);
        setPartialTranscription(`✅ "${transcribedText}"`);
        setRecordingState('complete');
        console.log('✅ Transcription successful:', transcribedText);
      } else {
        throw new Error(result.error || 'No speech detected or transcription failed');
      }
    } catch (error) {
      console.error('❌ Vosk processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      setError(errorMessage);
      setRecordingState('error');
      setPartialTranscription(`❌ ${errorMessage}`);
    } finally {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };
  const getFileExtension = (mimeType: string): string => {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
  };
  const handleUseText = () => {
    if (finalTranscription.trim()) {
      onTranscriptionComplete(finalTranscription.trim());
      handleClose();
    }
  };
  const handleRetry = () => {
    resetState();
    handleStart();
  };
  const handleClose = () => {
    cleanup();
    onClose();
  };
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Voice Input
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close voice input modal"
            title="Close"
          >
            <X size={24} />
          </button>
        </div>
        <div className="text-center mb-6">
          <div className="relative mb-4">
            <div className={cn(
              'w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-all duration-300',
              recordingState === 'recording' ? 'bg-red-500 text-white animate-pulse' :
              recordingState === 'processing' ? 'bg-blue-500 text-white' :
              recordingState === 'complete' ? 'bg-green-500 text-white' :
              recordingState === 'error' ? 'bg-red-500 text-white' :
              'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}>
              {recordingState === 'recording' ? (
                <Mic size={32} />
              ) : recordingState === 'processing' ? (
                <Loader2 size={32} className="animate-spin" />
              ) : recordingState === 'complete' ? (
                <CheckCircle size={32} />
              ) : recordingState === 'error' ? (
                <AlertCircle size={32} />
              ) : (
                <MicOff size={32} />
              )}
            </div>
            {isRecording && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1 bg-red-400 rounded-full transition-all duration-100',
                        audioLevel > (i * 20) ? 'h-4 opacity-100' : 'h-2 opacity-30'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {recordingState === 'recording' && `Recording... ${formatTime(recordingTime)}`}
            {recordingState === 'processing' && 'Processing audio...'}
            {recordingState === 'complete' && 'Transcription complete!'}
            {recordingState === 'error' && 'Error occurred'}
            {recordingState === 'idle' && 'Ready to record'}
            {recordingState === 'starting' && 'Starting...'}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 min-h-[80px]">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {recordingState === 'complete' ? 'Transcription:' : 'Status:'}
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {partialTranscription || 'Click "Start Recording" to begin...'}
          </div>
        </div>
        <div className="flex gap-3">
          {recordingState === 'idle' && (
            <button
              type="button"
              onClick={handleStart}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Mic size={18} />
              Start Recording
            </button>
          )}
          {(recordingState === 'recording' || recordingState === 'starting') && (
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Square size={18} />
              Stop Recording
            </button>
          )}
          {recordingState === 'complete' && (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleUseText}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Use Text
              </button>
            </>
          )}
          {recordingState === 'error' && (
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          )}
          {recordingState === 'processing' && (
            <button
              type="button"
              disabled
              className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg font-medium cursor-not-allowed"
            >
              Processing...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default VoiceRecordingModal;
