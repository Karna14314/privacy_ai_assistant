import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TAURI_ENV } from '../utils/tauriDetection';
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
interface UseTauriStreamingReturn {
  streamingState: StreamingState;
  startStream: (prompt: string, onChunk?: (chunk: string) => void, onComplete?: (fullContent: string) => void) => Promise<string>;
  stopStream: () => Promise<void>;
}
export const useTauriStreaming = (): UseTauriStreamingReturn => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    error: null,
    currentStreamId: null,
  });
  const currentStreamIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const fullContentRef = useRef<string>('');
  const startStream = useCallback(async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      console.log(' [TAURI STREAMING] Starting LLM stream...');
      if (!TAURI_ENV.isTauri || !TAURI_ENV.hasInvoke) {
        const error = 'Tauri streaming not available in browser environment';
        console.error('❌ [TAURI STREAMING]', error);
        reject(new Error(error));
        return;
      }
      try {
        if (currentStreamIdRef.current) {
          await stopStream();
        }
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await invoke('start_llm_stream', {
          streamId: streamId,
          prompt: prompt,
          model: null,
          systemPrompt: null
        });
        console.log('✅ [TAURI STREAMING] Stream started with ID:', streamId);
        currentStreamIdRef.current = streamId;
        fullContentRef.current = '';
        setStreamingState({
          isStreaming: true,
          streamedContent: '',
          error: null,
          currentStreamId: streamId,
        });
        console.log(' [TAURI STREAMING] Listening for events: llm-stream-event');
        const unlisten = await listen<StreamEvent>('llm-stream-event', (event) => {
          const streamEvent = event.payload;
          console.log(' [TAURI STREAMING] Received event:', streamEvent);
          if (streamEvent.stream_id !== streamId) {
            console.log(` [TAURI STREAMING] Ignoring event for different stream: ${streamEvent.stream_id} (expected: ${streamId})`);
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
            console.log('✅ [TAURI STREAMING] Stream completed');
            setStreamingState(prev => ({
              ...prev,
              isStreaming: false,
              currentStreamId: null,
            }));
            currentStreamIdRef.current = null;
            onComplete?.(fullContentRef.current);
            resolve(fullContentRef.current);
          } else if (streamEvent.event_type === 'error') {
            console.error('❌ [TAURI STREAMING] Stream error:', streamEvent.data);
            setStreamingState(prev => ({
              ...prev,
              isStreaming: false,
              error: streamEvent.data,
              currentStreamId: null,
            }));
            currentStreamIdRef.current = null;
            reject(new Error(streamEvent.data));
          }
        });
        unlistenRef.current = unlisten;
      } catch (error) {
        console.error('❌ [TAURI STREAMING] Failed to start stream:', error);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : String(error),
          currentStreamId: null,
        }));
        reject(error);
      }
    });
  }, []);
  const stopStream = useCallback(async (): Promise<void> => {
    console.log('⏹️ [TAURI STREAMING] Stopping stream...');
    if (currentStreamIdRef.current) {
      try {
        await invoke('stop_llm_stream', { stream_id: currentStreamIdRef.current });
        console.log('✅ [TAURI STREAMING] Stream stopped');
      } catch (error) {
        console.error('❌ [TAURI STREAMING] Failed to stop stream:', error);
      }
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
    };
  }, []);
  return {
    streamingState,
    startStream,
    stopStream,
  };
};
