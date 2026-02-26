import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
export interface LLMError {
  message: string;
  type: 'network' | 'service' | 'timeout' | 'validation' | 'unknown';
}
export interface LLMState {
  isLoading: boolean;
  error: LLMError | null;
  lastResponse: string | null;
}
export interface LLMHookReturn extends LLMState {
  queryLLM: (prompt: string) => Promise<string>;
  checkHealth: () => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}
const parseError = (errorMessage: string): LLMError => {
  const message = errorMessage.toLowerCase();
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      message: 'Request timed out. The AI model is taking too long to respond.',
      type: 'timeout'
    };
  }
  if (message.includes('connect') || message.includes('connection') || message.includes('unavailable')) {
    return {
      message: 'Cannot connect to the AI service. Please ensure Ollama is running on your system.',
      type: 'service'
    };
  }
  if (message.includes('network') || message.includes('http')) {
    return {
      message: 'Network error occurred while communicating with the AI service.',
      type: 'network'
    };
  }
  if (message.includes('empty prompt') || message.includes('validation')) {
    return {
      message: 'Please provide a valid prompt.',
      type: 'validation'
    };
  }
  return {
    message: errorMessage || 'An unexpected error occurred.',
    type: 'unknown'
  };
};
export const useLLM = (): LLMHookReturn => {
  const [state, setState] = useState<LLMState>({
    isLoading: false,
    error: null,
    lastResponse: null,
  });
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      lastResponse: null,
    });
  }, []);
  const queryLLM = useCallback(async (prompt: string): Promise<string> => {
    if (!prompt || prompt.trim().length === 0) {
      const error = parseError('Empty prompt provided');
      setState(prev => ({ ...prev, error }));
      throw new Error(error.message);
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length > 10000) {
      const error = parseError('Prompt is too long. Please keep it under 10,000 characters.');
      setState(prev => ({ ...prev, error }));
      throw new Error(error.message);
    }
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
    try {
      console.log('Sending prompt to LLM:', trimmedPrompt.substring(0, 100) + '...');
      const response = await invoke<string>('generate_llm_response', {
        prompt: trimmedPrompt,
      });
      if (!response || response.trim().length === 0) {
        throw new Error('Received empty response from AI service');
      }
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastResponse: response,
        error: null,
      }));
      console.log('LLM response received successfully');
      return response;
    } catch (error) {
      console.error('LLM query failed:', error);
      const parsedError = parseError(error instanceof Error ? error.message : String(error));
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: parsedError,
      }));
      throw new Error(parsedError.message);
    }
  }, []);
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Checking LLM service health...');
      const isHealthy = await invoke<boolean>('check_llm_health');
      console.log('LLM health check result:', isHealthy);
      return isHealthy;
    } catch (error) {
      console.error('LLM health check failed:', error);
      const parsedError = parseError(error instanceof Error ? error.message : String(error));
      setState(prev => ({ ...prev, error: parsedError }));
      return false;
    }
  }, []);
  return {
    ...state,
    queryLLM,
    checkHealth,
    clearError,
    reset,
  };
};
export const useLLMHealthCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const isHealthy = await invoke<boolean>('check_llm_health');
      setIsAvailable(isHealthy);
      setLastChecked(new Date());
      return isHealthy;
    } catch (error) {
      console.error('Health check failed:', error);
      setIsAvailable(false);
      setLastChecked(new Date());
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);
  return {
    isChecking,
    isAvailable,
    lastChecked,
    checkHealth,
  };
};
export default useLLM;
