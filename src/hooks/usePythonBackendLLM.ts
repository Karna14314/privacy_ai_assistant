import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
interface LLMResponse {
  response: string;
  model: string;
  success: boolean;
  error?: string;
}
interface BackendHealthResponse {
  status: string;
  vosk_initialized: boolean;
  timestamp: number;
}
interface OllamaModel {
  name: string;
  size: number;
  digest: string;
}
interface OllamaModelsResponse {
  models: OllamaModel[];
}
interface UsePythonBackendLLMReturn {
  isLoading: boolean;
  error: string | null;
  response: string | null;
  backendHealth: BackendHealthResponse | null;
  availableModels: OllamaModel[];
  startBackend: () => Promise<boolean>;
  stopBackend: () => Promise<boolean>;
  checkBackendHealth: () => Promise<boolean>;
  sendPrompt: (prompt: string, model?: string) => Promise<string>;
  getAvailableModels: () => Promise<OllamaModel[]>;
  clearResponse: () => void;
  clearError: () => void;
}
export const usePythonBackendLLM = (): UsePythonBackendLLMReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const clearResponse = useCallback(() => {
    setResponse(null);
  }, []);
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  const startBackend = useCallback(async (): Promise<boolean> => {
    try {
      console.log(' Starting Python backend...');
      setIsLoading(true);
      setError(null);
      const result = await invoke<string>('start_python_backend');
      console.log('✅ Backend start result:', result);
      const healthCheck = await checkBackendHealth();
      return healthCheck;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Failed to start Python backend:', errorMessage);
      setError(`Failed to start backend: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  const stopBackend = useCallback(async (): Promise<boolean> => {
    try {
      console.log('⏹️ Stopping Python backend...');
      setIsLoading(true);
      setError(null);
      const result = await invoke<string>('stop_python_backend');
      console.log('✅ Backend stop result:', result);
      setBackendHealth(null);
      setAvailableModels([]);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Failed to stop Python backend:', errorMessage);
      setError(`Failed to stop backend: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      console.log(' Checking Python backend health...');
      const health = await invoke<BackendHealthResponse>('check_python_backend');
      console.log('✅ Backend health:', health);
      setBackendHealth(health);
      setError(null);
      return health.status === 'healthy';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Backend health check failed:', errorMessage);
      setError(`Backend health check failed: ${errorMessage}`);
      setBackendHealth(null);
      return false;
    }
  }, []);
  const sendPrompt = useCallback(async (prompt: string, model?: string): Promise<string> => {
    try {
      console.log(' Sending prompt to Python backend LLM...');
      console.log(' Prompt length:', prompt.length);
      console.log(' Model:', model || 'default');
      setIsLoading(true);
      setError(null);
      setResponse(null);
      const llmResponse = await invoke<LLMResponse>('send_llm_request_to_backend', {
        prompt,
        model: model || undefined
      });
      console.log('✅ LLM response received:', llmResponse);
      if (llmResponse.success) {
        setResponse(llmResponse.response);
        return llmResponse.response;
      } else {
        const errorMsg = llmResponse.error || 'Unknown LLM error';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ LLM request failed:', errorMessage);
      setError(`LLM request failed: ${errorMessage}`);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);
  const getAvailableModels = useCallback(async (): Promise<OllamaModel[]> => {
    try {
      console.log(' Getting available Ollama models...');
      setError(null);
      const modelsResponse = await invoke<OllamaModelsResponse>('get_ollama_models_from_backend');
      console.log('✅ Available models:', modelsResponse);
      setAvailableModels(modelsResponse.models);
      return modelsResponse.models;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Failed to get available models:', errorMessage);
      setError(`Failed to get models: ${errorMessage}`);
      return [];
    }
  }, []);
  return {
    isLoading,
    error,
    response,
    backendHealth,
    availableModels,
    startBackend,
    stopBackend,
    checkBackendHealth,
    sendPrompt,
    getAvailableModels,
    clearResponse,
    clearError,
  };
};
