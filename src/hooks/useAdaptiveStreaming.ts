import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TAURI_ENV } from '../utils/tauriDetection';
import { useAppStore } from '../stores/chatStore';
interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;
  currentStreamId: string | null;
}
interface StreamEvent {
  stream_id: string;
  event_type: string;
  data: string;
}
interface UseAdaptiveStreamingReturn {
  streamingState: StreamingState;
  startStream: (prompt: string, onChunk?: (chunk: string) => void, onComplete?: (fullContent: string) => void) => Promise<string>;
  stopStream: () => Promise<void>;
}
export const useAdaptiveStreaming = (): UseAdaptiveStreamingReturn => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    error: null,
    currentStreamId: null,
  });
  const { llmPreferences } = useAppStore();
  const currentStreamIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const fullContentRef = useRef<string>('');
  const websocketRef = useRef<WebSocket | null>(null);
  const isOnlineModel = llmPreferences.preferredProvider === 'online';
  const startStream = useCallback(async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      console.log(' [ADAPTIVE STREAMING] Starting stream for:', isOnlineModel ? 'online' : 'offline', 'model');
      try {
        await stopStream();
        fullContentRef.current = '';
        setStreamingState({
          isStreaming: true,
          streamedContent: '',
          error: null,
          currentStreamId: null,
        });
        if (TAURI_ENV.isTauri && TAURI_ENV.hasInvoke) {
          await startTauriStream(prompt, onChunk, onComplete, resolve, reject);
        } else {
          await startWebSocketStream(prompt, onChunk, onComplete, resolve, reject);
        }
      } catch (error) {
        console.error('❌ [ADAPTIVE STREAMING] Failed to start stream:', error);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : String(error),
        }));
        reject(error);
      }
    });
  }, [isOnlineModel]);
  const startLocalOnlyStream = async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void,
    resolve?: (value: string) => void,
    reject?: (reason: any) => void
  ) => {
    try {
      console.log(' [LOCAL STREAMING] Starting local Ollama streaming...');
      const selectedModel = 'gemma2:2b';
      const { llmRouter } = await import('../core/agents/llmRouter');
      llmRouter.updatePreferences(llmPreferences);
      const response = await llmRouter.routeRequest(prompt, undefined, 'online');
      if (response.success && response.response) {
        const words = response.response.split(' ');
        const chunkSize = 2;
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
          fullContentRef.current += chunk;
          setStreamingState(prev => ({
            ...prev,
            streamedContent: fullContentRef.current,
          }));
          onChunk?.(chunk);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
        }));
        onComplete?.(fullContentRef.current);
        resolve?.(fullContentRef.current);
      } else {
        throw new Error(response.error || 'Online LLM request failed');
      }
    } catch (error) {
      console.error('❌ [ONLINE STREAMING] Error:', error);
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : String(error),
      }));
      reject?.(error);
    }
  };
  const startTauriStream = async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void,
    resolve?: (value: string) => void,
    reject?: (reason: any) => void
  ) => {
    try {
      console.log('️ [TAURI STREAMING] Starting Tauri streaming...');
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await invoke('start_llm_stream', {
        streamId: streamId,
        prompt: prompt,
        model: llmPreferences.selectedOfflineModel || null,
        systemPrompt: null
      });
      currentStreamIdRef.current = streamId;
      setStreamingState(prev => ({
        ...prev,
        currentStreamId: streamId,
      }));
      console.log(' [ADAPTIVE STREAMING] Listening for events: llm-stream-event');
      const unlisten = await listen<StreamEvent>('llm-stream-event', (event) => {
        const streamEvent = event.payload;
        if (streamEvent.stream_id !== streamId) {
          console.log(` [ADAPTIVE STREAMING] Ignoring event for different stream: ${streamEvent.stream_id} (expected: ${streamId})`);
          return;
        }
        if (streamEvent.event_type === 'chunk') {
          fullContentRef.current += streamEvent.data;
          setStreamingState(prev => ({
            ...prev,
            streamedContent: fullContentRef.current,
          }));
          onChunk?.(streamEvent.data);
        } else if (streamEvent.event_type === 'complete') {
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
            currentStreamId: null,
          }));
          currentStreamIdRef.current = null;
          onComplete?.(fullContentRef.current);
          resolve?.(fullContentRef.current);
        } else if (streamEvent.event_type === 'error') {
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
            error: streamEvent.data,
            currentStreamId: null,
          }));
          currentStreamIdRef.current = null;
          reject?.(new Error(streamEvent.data));
        }
      });
      unlistenRef.current = unlisten;
    } catch (error) {
      console.error('❌ [TAURI STREAMING] Error:', error);
      reject?.(error);
    }
  };
  const startWebSocketStream = async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void,
    resolve?: (value: string) => void,
    reject?: (reason: any) => void
  ) => {
    try {
      console.log(' [WEBSOCKET STREAMING] Starting WebSocket streaming...');
      const ws = new WebSocket('ws://127.0.0.1:8000/llm/stream');
      websocketRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({
          prompt,
          model: llmPreferences.selectedOfflineModel || 'gemma3n:latest'
        }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chunk') {
            fullContentRef.current += data.data;
            setStreamingState(prev => ({
              ...prev,
              streamedContent: fullContentRef.current,
            }));
            onChunk?.(data.data);
          } else if (data.type === 'complete') {
            setStreamingState(prev => ({
              ...prev,
              isStreaming: false,
            }));
            onComplete?.(fullContentRef.current);
            resolve?.(fullContentRef.current);
          } else if (data.type === 'error') {
            setStreamingState(prev => ({
              ...prev,
              isStreaming: false,
              error: data.data,
            }));
            reject?.(new Error(data.data));
          }
        } catch (parseError) {
          console.error('❌ [WEBSOCKET STREAMING] Parse error:', parseError);
          reject?.(parseError);
        }
      };
      ws.onerror = (error) => {
        console.error('❌ [WEBSOCKET STREAMING] WebSocket error:', error);
        reject?.(new Error('WebSocket connection failed'));
      };
    } catch (error) {
      console.error('❌ [WEBSOCKET STREAMING] Error:', error);
      reject?.(error);
    }
  };
  const stopStream = useCallback(async (): Promise<void> => {
    console.log('⏹️ [ADAPTIVE STREAMING] Stopping stream...');
    if (currentStreamIdRef.current) {
      try {
        await invoke('stop_llm_stream', { stream_id: currentStreamIdRef.current });
        console.log('✅ [ADAPTIVE STREAMING] Stream stopped');
      } catch (error) {
        console.error('❌ [ADAPTIVE STREAMING] Failed to stop stream:', error);
      }
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    currentStreamIdRef.current = null;
    fullContentRef.current = '';
    setStreamingState({
      isStreaming: false,
      streamedContent: '',
      error: null,
      currentStreamId: null,
    });
  }, []);
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);
  return {
    streamingState,
    startStream,
    stopStream,
  };
};
