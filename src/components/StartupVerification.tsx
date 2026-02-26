import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { modelHealthChecker } from '../utils/modelHealth';
import { invoke } from '@tauri-apps/api/core';
interface StartupVerificationProps {
  onVerificationComplete: (success: boolean) => void;
}
interface VerificationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'error';
  error?: string;
  recommendations?: string[];
}
export const StartupVerification: React.FC<StartupVerificationProps> = ({
  onVerificationComplete
}) => {
  const [steps, setSteps] = useState<VerificationStep[]>([
    {
      id: 'tauri',
      name: 'Desktop Environment',
      description: 'Verifying Tauri desktop environment',
      status: 'pending'
    },
    {
      id: 'ollama',
      name: 'LLM Service',
      description: 'Checking Ollama service availability',
      status: 'pending'
    },
    {
      id: 'gemma',
      name: 'Gemma 3n Model',
      description: 'Verifying Gemma 3n model installation',
      status: 'pending'
    },
    {
      id: 'audio',
      name: 'Audio System',
      description: 'Testing audio devices for voice features',
      status: 'pending'
    }
  ]);
  const [isVerifying, setIsVerifying] = useState(false);
  const updateStep = (id: string, updates: Partial<VerificationStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };
  const verifyTauriEnvironment = async (): Promise<boolean> => {
    updateStep('tauri', { status: 'checking' });
    try {
      if (typeof window === 'undefined' || !window.__TAURI__) {
        updateStep('tauri', { 
          status: 'error', 
          error: 'Tauri environment not available',
          recommendations: ['Please run the application in desktop mode']
        });
        return false;
      }
      updateStep('tauri', { status: 'success' });
      return true;
    } catch (error) {
      updateStep('tauri', { 
        status: 'error', 
        error: 'Failed to verify desktop environment',
        recommendations: ['Restart the application']
      });
      return false;
    }
  };
  const verifyLLMService = async (): Promise<boolean> => {
    updateStep('ollama', { status: 'checking' });
    try {
      const isHealthy = await modelHealthChecker.checkHealth();
      if (isHealthy) {
        updateStep('ollama', { status: 'success' });
        return true;
      } else {
        updateStep('ollama', { 
          status: 'error', 
          error: 'Ollama service is not responding',
          recommendations: [
            'Start Ollama service on your system',
            'Ensure Ollama is running on localhost:11434',
            'Check if Ollama is installed correctly'
          ]
        });
        return false;
      }
    } catch (error) {
      updateStep('ollama', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          'Install Ollama from https://ollama.ai',
          'Start the Ollama service',
          'Check your firewall settings'
        ]
      });
      return false;
    }
  };
  const verifyGemmaModel = async (): Promise<boolean> => {
    updateStep('gemma', { status: 'checking' });
    try {
      const response = await invoke<string>('generate_llm_response', { 
        prompt: 'Hello' 
      });
      if (response && response.trim().length > 0) {
        updateStep('gemma', { status: 'success' });
        return true;
      } else {
        updateStep('gemma', { 
          status: 'error', 
          error: 'Gemma 3n model is not responding',
          recommendations: [
            'Install Gemma 3n model: ollama pull gemma3n',
            'Wait for the model to finish loading',
            'Check Ollama logs for errors'
          ]
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStep('gemma', { 
        status: 'error', 
        error: errorMsg,
        recommendations: [
          'Install Gemma 3n model: ollama pull gemma3n',
          'Ensure sufficient system memory (8GB+ recommended)',
          'Check if the model name is correct'
        ]
      });
      return false;
    }
  };
  const verifyAudioSystem = async (): Promise<boolean> => {
    updateStep('audio', { status: 'checking' });
    try {
      const result = await invoke<string>('test_audio_devices');
      if (result && result.includes('success')) {
        updateStep('audio', { status: 'success' });
        return true;
      } else {
        updateStep('audio', { 
          status: 'error', 
          error: 'Audio devices not available',
          recommendations: [
            'Check microphone permissions',
            'Ensure audio drivers are installed',
            'Voice features will be limited'
          ]
        });
        return false;
      }
    } catch (error) {
      updateStep('audio', { 
        status: 'error', 
        error: 'Audio system check failed',
        recommendations: [
          'Audio features may not work properly',
          'Check system audio settings',
          'Voice input will be unavailable'
        ]
      });
      return false;
    }
  };
  const runVerification = async () => {
    setIsVerifying(true);
    const tauriOk = await verifyTauriEnvironment();
    const ollamaOk = await verifyLLMService();
    const gemmaOk = await verifyGemmaModel();
    await verifyAudioSystem();
    const coreSuccess = tauriOk && ollamaOk && gemmaOk;
    setIsVerifying(false);
    onVerificationComplete(coreSuccess);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      runVerification();
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  const getStepIcon = (step: VerificationStep) => {
    switch (step.status) {
      case 'checking':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };
  const allStepsComplete = steps.every(step => step.status !== 'pending' && step.status !== 'checking');
  const criticalErrors = steps.filter(step =>
    step.status === 'error' && ['tauri', 'ollama', 'gemma'].includes(step.id)
  );
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Starting Privacy AI Assistant
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Verifying system requirements and model availability...
          </p>
        </div>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {step.name}
                  </h3>
                  {step.status === 'checking' && (
                    <span className="text-xs text-blue-500">Checking...</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {step.description}
                </p>
                {step.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300">
                    {step.error}
                  </div>
                )}
                {step.recommendations && step.recommendations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {step.recommendations.map((rec, index) => (
                      <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                        • {rec}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {allStepsComplete && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {criticalErrors.length === 0 ? (
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  System ready! Starting application...
                </p>
              </div>
            ) : (
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">
                  Critical components are not available
                </p>
                <button
                  type="button"
                  onClick={runVerification}
                  disabled={isVerifying}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-4 h-4 mr-2', isVerifying && 'animate-spin')} />
                  Retry Verification
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default StartupVerification;
