import { invoke } from '@tauri-apps/api/core';
import { TAURI_ENV } from './tauriDetection';
export interface ModelHealthStatus {
  isAvailable: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  connectionState: 'connected' | 'disconnected' | 'checking' | 'error';
  modelName: string;
  serviceUrl: string;
  lastSuccessfulCheck: Date | null;
}
export class ModelHealthChecker {
  private static instance: ModelHealthChecker;
  private status: ModelHealthStatus = {
    isAvailable: false,
    isChecking: false,
    lastChecked: null,
    error: null,
    connectionState: 'disconnected',
    modelName: 'gemma3n:latest',
    serviceUrl: 'http://localhost:11434',
    lastSuccessfulCheck: null,
  };
  private listeners: Array<(status: ModelHealthStatus) => void> = [];
  private constructor() {}
  static getInstance(): ModelHealthChecker {
    if (!ModelHealthChecker.instance) {
      ModelHealthChecker.instance = new ModelHealthChecker();
    }
    return ModelHealthChecker.instance;
  }
  subscribe(listener: (status: ModelHealthStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.status));
  }
  async checkHealth(): Promise<boolean> {
    if (this.status.isChecking) {
      return this.status.isAvailable;
    }
    if (!TAURI_ENV.isTauri) {
      console.log('Running in browser mode - model health check disabled');
      this.status = {
        ...this.status,
        isAvailable: false,
        isChecking: false,
        lastChecked: new Date(),
        error: 'Tauri environment not available',
        connectionState: 'error',
      };
      this.notifyListeners();
      return false;
    }
    this.status = {
      ...this.status,
      isChecking: true,
      error: null,
      connectionState: 'checking',
    };
    this.notifyListeners();
    try {
      console.log('Checking model health...');
      const isHealthy = await invoke<boolean>('check_llm_health');
      this.status = {
        ...this.status,
        isAvailable: isHealthy,
        isChecking: false,
        lastChecked: new Date(),
        error: isHealthy ? null : 'Model is not responding',
        connectionState: isHealthy ? 'connected' : 'disconnected',
        lastSuccessfulCheck: isHealthy ? new Date() : this.status.lastSuccessfulCheck,
      };
      console.log('Model health check result:', isHealthy);
      this.notifyListeners();
      return isHealthy;
    } catch (error) {
      console.error('Model health check failed:', error);
      this.status = {
        ...this.status,
        isAvailable: false,
        isChecking: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
        connectionState: 'error',
      };
      this.notifyListeners();
      return false;
    }
  }
  getStatus(): ModelHealthStatus {
    return { ...this.status };
  }
  async startPeriodicCheck(intervalMs: number = 15000): Promise<void> {
    await this.checkHealth();
    setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);
  }
  async forceCheck(): Promise<boolean> {
    return await this.checkHealth();
  }
  getDetailedStatus(): {
    status: ModelHealthStatus;
    statusText: string;
    recommendations: string[];
  } {
    const status = this.getStatus();
    let statusText = '';
    let recommendations: string[] = [];
    switch (status.connectionState) {
      case 'connected':
        statusText = `${status.modelName} is connected and ready`;
        break;
      case 'checking':
        statusText = 'Checking model availability...';
        break;
      case 'disconnected':
        statusText = `${status.modelName} is not available`;
        recommendations = [
          'Ensure Ollama is running on your system',
          'Check if the Gemma 3n model is installed: ollama pull gemma3n:latest',
          'Verify Ollama is accessible at ' + status.serviceUrl
        ];
        break;
      case 'error':
        statusText = status.error || 'Unknown error occurred';
        if (status.error?.includes('Tauri')) {
          recommendations = ['Please run the application in desktop mode'];
        } else {
          recommendations = [
            'Check your internet connection',
            'Restart Ollama service',
            'Verify model installation'
          ];
        }
        break;
    }
    return { status, statusText, recommendations };
  }
  async checkModelInstallation(): Promise<{ installed: boolean; availableModels: string[] }> {
    try {
      if (!TAURI_ENV.isTauri) {
        return { installed: false, availableModels: [] };
      }
      const isHealthy = await this.checkHealth();
      return {
        installed: isHealthy,
        availableModels: isHealthy ? ['gemma3n:latest'] : []
      };
    } catch (error) {
      console.error('Failed to check model installation:', error);
      return { installed: false, availableModels: [] };
    }
  }
}
export const modelHealthChecker = ModelHealthChecker.getInstance();
