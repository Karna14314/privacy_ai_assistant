import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square,
  Settings,
  User,
  Bot,
  Clock,
  Loader2,
  Zap,
  RotateCcw
} from 'lucide-react';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
interface VoiceChatProps {
  className?: string;
  isVisible?: boolean;
  onToggle?: () => void;
  onTranscriptUpdate?: (transcript: string, isUser: boolean) => void;
}
interface VoiceMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  status: 'transcribing' | 'processing' | 'speaking' | 'complete';
  audioUrl?: string;
}
interface VoiceSettings {
  mode: 'push-to-talk' | 'continuous';
  silenceThreshold: number;
  playbackSpeed: number;
  autoPlay: boolean;
}
export const VoiceChat: React.FC<VoiceChatProps> = ({
  className,
  isVisible = false,
  onToggle,
  onTranscriptUpdate
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>({
    mode: 'push-to-talk',
    silenceThreshold: 3,
    playbackSpeed: 1.0,
    autoPlay: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const initializeAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      drawWaveform();
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }, []);
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = 'rgb(15, 23, 42)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      setAudioLevel(average);
      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        const intensity = dataArray[i] / 255;
        if (intensity > 0.7) {
          ctx.fillStyle = 'rgb(239, 68, 68)';
        } else if (intensity > 0.4) {
          ctx.fillStyle = 'rgb(245, 158, 11)';
        } else {
          ctx.fillStyle = 'rgb(34, 197, 94)';
        }
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };
    draw();
  }, [isRecording]);
  const startRecording = useCallback(async () => {
    try {
      console.log(' [Voice Chat] Starting recording...');
      setIsRecording(true);
      setCurrentTranscript('');
      if (!streamRef.current) {
        await initializeAudioVisualization();
      }
      await invoke('start_continuous_voice_chat', { 
        streamId: `voice_${Date.now()}` 
      });
      drawWaveform();
      if (settings.mode === 'continuous') {
        startSilenceDetection();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  }, [settings.mode, initializeAudioVisualization, drawWaveform]);
  const stopRecording = useCallback(async () => {
    try {
      console.log(' [Voice Chat] Stopping recording...');
      setIsRecording(false);
      setIsProcessing(true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
      }
      const transcript = await invoke('vosk_transcribe') as string;
      if (transcript && transcript.trim()) {
        const userMessage: VoiceMessage = {
          id: `user_${Date.now()}`,
          content: transcript,
          isUser: true,
          timestamp: new Date(),
          status: 'complete'
        };
        setVoiceMessages(prev => [...prev, userMessage]);
        setCurrentTranscript(transcript);
        onTranscriptUpdate?.(transcript, true);
        await generateVoiceResponse(transcript);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [silenceTimer, onTranscriptUpdate]);
  const generateVoiceResponse = useCallback(async (userInput: string) => {
    try {
      console.log(' [Voice Chat] Generating AI response...');
      const aiMessage: VoiceMessage = {
        id: `ai_${Date.now()}`,
        content: '',
        isUser: false,
        timestamp: new Date(),
        status: 'processing'
      };
      setVoiceMessages(prev => [...prev, aiMessage]);
      const response = await invoke('generate_llm_response', { 
        prompt: userInput 
      }) as string;
      setVoiceMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessage.id 
            ? { ...msg, content: response, status: 'speaking' }
            : msg
        )
      );
      onTranscriptUpdate?.(response, false);
      if (settings.autoPlay) {
        await speakResponse(response, aiMessage.id);
      } else {
        setVoiceMessages(prev => 
          prev.map(msg => 
            msg.id === aiMessage.id 
              ? { ...msg, status: 'complete' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Failed to generate voice response:', error);
    }
  }, [settings.autoPlay, onTranscriptUpdate]);
  const speakResponse = useCallback(async (text: string, messageId: string) => {
    try {
      console.log(' [Voice Chat] Speaking response...');
      setIsSpeaking(true);
      await invoke('run_piper_tts_with_config', {
        text,
        speed: settings.playbackSpeed,
        voice: 'default'
      });
      setVoiceMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'complete' }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to speak response:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [settings.playbackSpeed]);
  const startSilenceDetection = useCallback(() => {
    const timer = setTimeout(() => {
      if (isRecording && audioLevel < 10) {
        console.log(' [Voice Chat] Silence detected, processing...');
        stopRecording();
      }
    }, settings.silenceThreshold * 1000);
    setSilenceTimer(timer);
  }, [isRecording, audioLevel, settings.silenceThreshold, stopRecording]);
  const handleRecordingToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);
  const handleSpeedChange = (speed: number) => {
    setSettings(prev => ({ ...prev, playbackSpeed: speed }));
  };
  const handleModeChange = (mode: 'push-to-talk' | 'continuous') => {
    setSettings(prev => ({ ...prev, mode }));
  };
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [silenceTimer]);
  if (!isVisible) return null;
  return (
    <div className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      {}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Mic size={20} className="text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Voice Chat
          </span>
          <div className={cn(
            'px-2 py-1 rounded-full text-xs',
            isRecording ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            isProcessing ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            isSpeaking ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          )}>
            {isRecording ? 'Recording' : 
             isProcessing ? 'Processing' : 
             isSpeaking ? 'Speaking' : 'Ready'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="space-y-4">
            {}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Input Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleModeChange('push-to-talk')}
                  className={cn(
                    'px-3 py-2 rounded text-sm transition-colors',
                    settings.mode === 'push-to-talk'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  Push-to-Talk
                </button>
                <button
                  onClick={() => handleModeChange('continuous')}
                  className={cn(
                    'px-3 py-2 rounded text-sm transition-colors',
                    settings.mode === 'continuous'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  Continuous
                </button>
              </div>
            </div>
            {}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Playback Speed: {settings.playbackSpeed}x
              </label>
              <div className="flex gap-2">
                {[0.5, 1.0, 1.5, 2.0].map(speed => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={cn(
                      'px-3 py-1 rounded text-sm transition-colors',
                      settings.playbackSpeed === speed
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
            {}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-play responses
              </label>
              <button
                onClick={() => setSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors',
                  settings.autoPlay ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full transition-transform',
                  settings.autoPlay ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          </div>
        </div>
      )}
      {}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <canvas
          ref={canvasRef}
          width={400}
          height={100}
          className="w-full h-20 bg-gray-900 rounded"
        />
      </div>
      {}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleRecordingToggle}
            disabled={isProcessing}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200',
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <Loader2 size={24} className="animate-spin" />
            ) : isRecording ? (
              <Square size={24} />
            ) : (
              <Mic size={24} />
            )}
          </button>
          {settings.mode === 'push-to-talk' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isRecording ? 'Release to stop' : 'Hold to record'}
            </div>
          )}
          {settings.mode === 'continuous' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isRecording ? `Auto-stop in ${settings.silenceThreshold}s of silence` : 'Click to start continuous recording'}
            </div>
          )}
        </div>
      </div>
      {}
      {currentTranscript && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Current:</strong> {currentTranscript}
          </div>
        </div>
      )}
      {}
      <div className="flex-1 overflow-auto max-h-96">
        {voiceMessages.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Mic size={48} className="mx-auto mb-4 opacity-50" />
            <p>Start a voice conversation</p>
            <p className="text-sm mt-2">Your speech will appear here in real-time</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {voiceMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.isUser ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={cn(
                  'flex gap-2 max-w-xs',
                  message.isUser ? 'flex-row-reverse' : 'flex-row'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    message.isUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-600 text-white'
                  )}>
                    {message.isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn(
                    'p-3 rounded-lg',
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  )}>
                    <div className="text-sm">{message.content}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                      {message.status === 'transcribing' && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                      {message.status === 'processing' && (
                        <RotateCcw size={12} className="animate-spin" />
                      )}
                      {message.status === 'speaking' && (
                        <Volume2 size={12} className="animate-pulse" />
                      )}
                      {!message.isUser && message.status === 'complete' && (
                        <button
                          onClick={() => speakResponse(message.content, message.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          title="Replay"
                        >
                          <Play size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default VoiceChat;
