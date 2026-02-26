import { useState, useRef, useCallback } from 'react';
interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;
  currentStreamId: string | null;
}
interface UseStreamingLLMReturn {
  streamingState: StreamingState;
  startStream: (prompt: string, onChunk?: (chunk: string) => void, onComplete?: (fullContent: string) => void) => Promise<string>;
  stopStream: () => Promise<void>;
}
const PYTHON_BACKEND_WS_URL = 'ws://127.0.0.1:8000/llm/stream';
export const useStreamingLLM = (): UseStreamingLLMReturn => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    error: null,
    currentStreamId: null,
  });
  const websocketRef = useRef<WebSocket | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);
  const stopStream = useCallback(async (): Promise<void> => {
    console.log('⏹️ [STREAMING] Stopping stream...');
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
      currentStreamId: null,
    }));
    currentStreamIdRef.current = null;
  }, []);
  const startStream = useCallback(async (
    prompt: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullContent: string) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log(' [STREAMING] Starting LLM stream...');
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      const streamId = Date.now().toString();
      currentStreamIdRef.current = streamId;
      let fullContent = '';
      setStreamingState({
        isStreaming: true,
        streamedContent: '',
        error: null,
        currentStreamId: streamId,
      });
      try {
        const ws = new WebSocket(PYTHON_BACKEND_WS_URL);
        websocketRef.current = ws;
        ws.onopen = () => {
          console.log('✅ [STREAMING] WebSocket connected');
          const request = {
            prompt,
            model: 'gemma3n:latest'
          };
          ws.send(JSON.stringify(request));
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(' [STREAMING] Received:', data);
            if (data.type === 'chunk') {
              fullContent += data.data;
              setStreamingState(prev => ({
                ...prev,
                streamedContent: fullContent,
              }));
              onChunk?.(data.data);
            } else if (data.type === 'complete') {
              console.log('✅ [STREAMING] Stream completed');
              setStreamingState(prev => ({
                ...prev,
                isStreaming: false,
                currentStreamId: null,
              }));
              onComplete?.(fullContent);
              resolve(fullContent);
            } else if (data.type === 'error') {
              console.error('❌ [STREAMING] Stream error:', data.data);
              setStreamingState(prev => ({
                ...prev,
                isStreaming: false,
                error: data.data,
                currentStreamId: null,
              }));
              reject(new Error(data.data));
            }
          } catch (e) {
            console.error('❌ [STREAMING] Failed to parse message:', e);
            setStreamingState(prev => ({
              ...prev,
              error: 'Failed to parse streaming response',
            }));
          }
        };
        ws.onerror = (error) => {
          console.error('❌ [STREAMING] WebSocket error:', error);
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
            error: 'WebSocket connection error',
            currentStreamId: null,
          }));
          reject(new Error('WebSocket connection failed'));
        };
        ws.onclose = (event) => {
          console.log(' [STREAMING] WebSocket closed:', event.code, event.reason);
          if (currentStreamIdRef.current === streamId) {
            setStreamingState(prev => ({
              ...prev,
              isStreaming: false,
              currentStreamId: null,
            }));
          }
          websocketRef.current = null;
        };
      } catch (error) {
        console.error('❌ [STREAMING] Failed to create WebSocket:', error);
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: 'Failed to create WebSocket connection',
          currentStreamId: null,
        }));
        reject(error);
      }
    });
  }, []);
  return {
    streamingState,
    startStream,
    stopStream,
  };
};
