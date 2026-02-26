import { useState, useRef, useCallback, useEffect } from 'react';
interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;
}
interface UsePythonBackendStreamingReturn {
  streamingState: StreamingState;
  startStream: (prompt: string, model?: string, onChunk?: (chunk: string) => void, onComplete?: () => void, onError?: (error: string) => void) => Promise<void>;
  stopStream: () => void;
  resetStream: () => void;
}
const PYTHON_BACKEND_WS_URL = 'ws://127.0.0.1:8000/llm/stream';
export const usePythonBackendStreaming = (): UsePythonBackendStreamingReturn => {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamedContent: '',
    error: null,
  });
  const websocketRef = useRef<WebSocket | null>(null);
  const onChunkRef = useRef<((chunk: string) => void) | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const onErrorRef = useRef<((error: string) => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStreamingState(prev => ({ ...prev, isStreaming: false }));
  }, []);
  const connect = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(' Connecting to Python backend streaming WebSocket...');
        const ws = new WebSocket(PYTHON_BACKEND_WS_URL);
        const connectionTimeout = setTimeout(() => {
          console.error('❌ WebSocket connection timeout');
          ws.close();
          reject(new Error('Connection timeout - please check if the backend server is running'));
        }, 10000);
        ws.onopen = () => {
          console.log('✅ Streaming WebSocket connected to Python backend');
          clearTimeout(connectionTimeout);
          websocketRef.current = ws;
          resolve(ws);
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(' Streaming message received:', message);
            switch (message.type) {
              case 'chunk':
                setStreamingState(prev => {
                  const newContent = prev.streamedContent + (message.data || '');
                  if (onChunkRef.current) {
                    onChunkRef.current(newContent);
                  }
                  return {
                    ...prev,
                    streamedContent: newContent
                  };
                });
                break;
              case 'complete':
                console.log('✅ Streaming completed');
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setStreamingState(prev => ({ ...prev, isStreaming: false }));
                if (onCompleteRef.current) {
                  onCompleteRef.current();
                }
                break;
              case 'error':
                console.error('❌ Streaming error:', message.data);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setStreamingState(prev => ({
                  ...prev,
                  isStreaming: false,
                  error: message.data
                }));
                if (onErrorRef.current) {
                  onErrorRef.current(message.data);
                }
                break;
            }
          } catch (e) {
            console.error('❌ Failed to parse streaming message:', e);
          }
        };
        ws.onerror = (error) => {
          console.error('❌ Streaming WebSocket error:', error);
          clearTimeout(connectionTimeout);
          const errorMsg = 'WebSocket connection failed. Please check if the backend server is running on port 8000.';
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
            error: errorMsg
          }));
          if (onErrorRef.current) {
            onErrorRef.current(errorMsg);
          }
          reject(new Error(errorMsg));
        };
        ws.onclose = (event) => {
          console.log(' Streaming WebSocket closed:', event.code, event.reason);
          clearTimeout(connectionTimeout);
          setStreamingState(prev => ({ ...prev, isStreaming: false }));
          websocketRef.current = null;
          if (event.code !== 1000 && event.code !== 1001) {
            const errorMsg = `WebSocket closed unexpectedly (code: ${event.code}). Backend may have stopped.`;
            if (onErrorRef.current) {
              onErrorRef.current(errorMsg);
            }
          }
        };
      } catch (e) {
        console.error('❌ Failed to create streaming WebSocket:', e);
        reject(e);
      }
    });
  }, []);
  const startStream = useCallback(async (
    prompt: string,
    model?: string,
    onChunk?: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) => {
    try {
      console.log(' Starting Python backend streaming for prompt:', prompt);
      onChunkRef.current = onChunk || null;
      onCompleteRef.current = onComplete || null;
      onErrorRef.current = onError || null;
      setStreamingState({
        isStreaming: true,
        streamedContent: '',
        error: null,
      });
      let ws = websocketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = await connect();
      }
      const request = {
        prompt,
        model: model || 'gemma3n:latest'
      };
      console.log(' Sending streaming request:', request);
      ws.send(JSON.stringify(request));
      timeoutRef.current = setTimeout(() => {
        console.error('❌ Streaming timeout after 2 minutes');
        const errorMsg = 'Request timed out after 2 minutes';
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMsg
        }));
        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
        disconnect();
      }, 120000);
    } catch (error) {
      console.error('❌ Failed to start streaming:', error);
      const errorMsg = `Failed to start streaming: ${error}`;
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMsg
      }));
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [connect]);
  const stopStream = useCallback(() => {
    console.log('⏹️ Stopping Python backend streaming...');
    disconnect();
  }, [disconnect]);
  const resetStream = useCallback(() => {
    console.log(' Resetting Python backend streaming state...');
    setStreamingState({
      isStreaming: false,
      streamedContent: '',
      error: null,
    });
    onChunkRef.current = null;
    onCompleteRef.current = null;
    onErrorRef.current = null;
  }, []);
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  return {
    streamingState,
    startStream,
    stopStream,
    resetStream,
  };
};
