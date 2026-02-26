import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { usePythonBackendLLM } from '../hooks/usePythonBackendLLM';
import { useRealtimeSTT } from '../hooks/useRealtimeSTT';
interface AudioDiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
interface DiagnosticResult {
  test: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}
export const AudioDiagnosticPanel: React.FC<AudioDiagnosticPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const { backendHealth, checkBackendHealth } = usePythonBackendLLM();
  const { 
    micPermission, 
    requestMicPermission, 
    isConnected: sttConnected,
    startRecording,
    stopRecording,
    isRecording,
    finalText,
    error: sttError
  } = useRealtimeSTT();
  const addDiagnostic = (test: string, status: DiagnosticResult['status'], message: string, details?: string) => {
    setDiagnostics(prev => [
      ...prev.filter(d => d.test !== test),
      { test, status, message, details }
    ]);
  };
  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);
    setCurrentTest('Microphone Access');
    try {
      const hasPermission = await requestMicPermission();
      if (hasPermission) {
        addDiagnostic('mic-access', 'success', 'Microphone access granted');
      } else {
        addDiagnostic('mic-access', 'error', 'Microphone access denied', 'Please enable microphone permissions in browser settings');
      }
    } catch (error) {
      addDiagnostic('mic-access', 'error', 'Microphone test failed', String(error));
    }
    setCurrentTest('Audio Recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      if (tracks.length > 0 && tracks[0].enabled) {
        addDiagnostic('audio-recording', 'success', 'Audio recording capability verified');
        stream.getTracks().forEach(track => track.stop());
      } else {
        addDiagnostic('audio-recording', 'error', 'No active audio tracks found');
      }
    } catch (error) {
      addDiagnostic('audio-recording', 'error', 'Audio recording test failed', String(error));
    }
    setCurrentTest('Backend Health');
    try {
      const isHealthy = await checkBackendHealth();
      if (isHealthy) {
        addDiagnostic('backend-health', 'success', 'Python backend is healthy');
      } else {
        addDiagnostic('backend-health', 'error', 'Backend health check failed', 'Backend reported unhealthy status');
      }
    } catch (error) {
      addDiagnostic('backend-health', 'error', 'Backend health check failed', String(error));
    }
    setCurrentTest('STT WebSocket');
    try {
      if (sttConnected) {
        addDiagnostic('stt-websocket', 'success', 'STT WebSocket connected');
      } else {
        addDiagnostic('stt-websocket', 'warning', 'STT WebSocket not connected', 'Try starting a recording to establish connection');
      }
    } catch (error) {
      addDiagnostic('stt-websocket', 'error', 'STT WebSocket test failed', String(error));
    }
    setCurrentTest('Static STT Test');
    try {
      const result = await invoke<any>('test_static_file_stt');
      if (result.success && result.text) {
        addDiagnostic('static-stt', 'success', `STT test successful: "${result.text}"`);
      } else {
        addDiagnostic('static-stt', 'error', 'Static STT test failed', result.text || 'Unknown error');
      }
    } catch (error) {
      addDiagnostic('static-stt', 'error', 'Static STT test failed', String(error));
    }
    setCurrentTest('LLM Response Test');
    try {
      const response = await invoke<string>('generate_llm_response', {
        prompt: 'Hello, this is a test message. Please respond briefly.'
      });
      if (response && response.trim().length > 0) {
        addDiagnostic('llm-response', 'success', 'LLM response test successful');
      } else {
        addDiagnostic('llm-response', 'error', 'LLM returned empty response');
      }
    } catch (error) {
      addDiagnostic('llm-response', 'error', 'LLM response test failed', String(error));
    }
    setCurrentTest('');
    setIsRunning(false);
  };
  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300 animate-pulse" />;
    }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Audio System Diagnostics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Test microphone, STT, and LLM functionality
          </p>
        </div>
        <div className="p-6 overflow-y-auto max-h-96">
          {isRunning && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Running: {currentTest}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {diagnostics.map((diagnostic, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                {getStatusIcon(diagnostic.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {diagnostic.test}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {diagnostic.message}
                  </p>
                  {diagnostic.details && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                      {diagnostic.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {diagnostics.length === 0 && !isRunning && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Click "Run Diagnostics" to test your audio system
              </p>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default AudioDiagnosticPanel;
