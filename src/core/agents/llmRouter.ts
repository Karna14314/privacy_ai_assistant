import { invoke } from '@tauri-apps/api/core';
import { LLMProvider, LLMModel, LLMConfig, LLMRoutingPreferences, NetworkStatus } from '../../types';
export enum ModelProvider {
  LOCAL_GEMMA3N = 'local_gemma3n',
  ONLINE_GEMINI = 'online_gemini',
  HYBRID_AUTO = 'hybrid_auto'
}
export interface ConnectivityStatus {
  isOnline: boolean;
  latency: number;
  lastCheck: Date;
  geminiApiReachable: boolean;
}
export interface LLMResponse {
  success: boolean;
  response?: string;
  error?: string;
  provider: LLMProvider;
  model: LLMModel;
  executionTime: number;
  tokenCount?: number;
}
export interface LLMRouterConfig {
  preferences: LLMRoutingPreferences;
  networkCheckInterval: number;
  requestTimeout: number;
}
export class LLMRouter {
  private config: LLMRouterConfig;
  private networkStatus: NetworkStatus;
  private networkCheckTimer?: NodeJS.Timeout;
  private currentProvider: ModelProvider = ModelProvider.LOCAL_GEMMA3N;
  private connectivityStatus: ConnectivityStatus = {
    isOnline: false,
    latency: 0,
    lastCheck: new Date(),
    geminiApiReachable: false
  };
  private readonly LOCAL_MODEL = 'gemma3n:latest';
  private readonly ONLINE_MODEL = 'gemini-1.5-flash';
  private readonly GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyC757g1ptvolgutJo4JvHofjpAvhQXFoLM';
  private isValidApiKey(key: string): boolean {
    return key && key.startsWith('AIza') && key.length > 30;
  }
  constructor(config?: Partial<LLMRouterConfig>) {
    this.config = {
      preferences: {
        preferredProvider: 'local',
        fallbackProvider: 'local',
        autoSwitchOnOffline: true,
        useOnlineForComplexQueries: true,
      },
      networkCheckInterval: 30000,
      requestTimeout: 60000,
      ...config
    };
    this.networkStatus = {
      isOnline: typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true,
      lastChecked: new Date()
    };
    this.initializeNetworkMonitoring();
    this.initializeConnectivityMonitoring();
  }
  async routeRequest(prompt: string, systemPrompt?: string, forceProvider?: LLMProvider): Promise<LLMResponse> {
    const complexity = this.calculateComplexity(prompt);
    const optimalModel = await this.selectOptimalModel(complexity, forceProvider as any);
    console.log(` [LLM ROUTER] Routing decision:`, optimalModel);
    try {
      if (optimalModel.selectedProvider === ModelProvider.ONLINE_GEMINI) {
        return await this.executeOnlineRequest(prompt, systemPrompt, optimalModel.model);
      } else {
        return await this.executeLocalRequest(prompt, systemPrompt, optimalModel.model);
      }
    } catch (error) {
      console.error(`❌ [LLM ROUTER] ${optimalModel.selectedProvider} request failed:`, error);
      if (optimalModel.fallbackProvider) {
        console.log(` [LLM ROUTER] Attempting fallback to ${optimalModel.fallbackProvider}`);
        try {
          if (optimalModel.fallbackProvider === ModelProvider.LOCAL_GEMMA3N) {
            return await this.executeLocalRequest(prompt, systemPrompt, this.LOCAL_MODEL);
          }
        } catch (fallbackError) {
          console.error(`❌ [LLM ROUTER] Fallback also failed:`, fallbackError);
        }
      }
      return {
        success: false,
        response: '',
        provider: 'local',
        model: this.LOCAL_MODEL,
        executionTime: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  public async selectOptimalModel(
    complexity: number = 0.5,
    forceProvider?: ModelProvider
  ): Promise<{
    selectedProvider: ModelProvider;
    model: string;
    reason: string;
    estimatedResponseTime: number;
    fallbackProvider?: ModelProvider;
  }> {
    console.log(' [LLM Router] Selecting optimal model...', { complexity, forceProvider });
    if (forceProvider) {
      return this.createRoutingDecision(forceProvider, complexity, 'User forced selection');
    }
    await this.checkConnectivity();
    switch (this.currentProvider) {
      case ModelProvider.LOCAL_GEMMA3N:
        return this.createRoutingDecision(
          ModelProvider.LOCAL_GEMMA3N,
          complexity,
          'Local-only mode selected'
        );
      case ModelProvider.ONLINE_GEMINI:
        if (this.connectivityStatus.isOnline && this.connectivityStatus.geminiApiReachable) {
          return this.createRoutingDecision(
            ModelProvider.ONLINE_GEMINI,
            complexity,
            'Online-only mode with good connectivity'
          );
        } else {
          return this.createRoutingDecision(
            ModelProvider.LOCAL_GEMMA3N,
            complexity,
            'Online mode requested but connectivity failed, falling back to local',
            ModelProvider.ONLINE_GEMINI
          );
        }
      case ModelProvider.HYBRID_AUTO:
        return this.selectHybridModel(complexity);
      default:
        return this.createRoutingDecision(
          ModelProvider.LOCAL_GEMMA3N,
          complexity,
          'Default fallback to local model'
        );
    }
  }
  private async executeLocalRequest(prompt: string, systemPrompt?: string, model: string = 'gemma3n:latest'): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      console.log(`️ [LLM ROUTER] Executing local request with model: ${model}`);
      const response = await invoke('generate_llm_response', { prompt });
      return {
        success: true,
        response,
        model,
        provider: 'local',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ [LLM ROUTER] Local request failed:', error);
      throw error;
    }
  }
  private async executeOnlineRequest(prompt: string, systemPrompt?: string, model: string = 'gemini-1.5-flash'): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      console.log(` [LLM ROUTER] Executing online request with model: ${model}`);
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model });
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nUser: ${prompt}`
        : prompt;
      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response.text();
      return {
        success: true,
        response,
        model,
        provider: 'online',
        executionTime: Date.now() - startTime,
        tokenCount: response.length
      };
    } catch (error) {
      console.error('❌ [LLM ROUTER] Online request failed:', error);
      throw error;
    }
  }
  private async selectHybridModel(complexity: number): Promise<{
    selectedProvider: ModelProvider;
    model: string;
    reason: string;
    estimatedResponseTime: number;
    fallbackProvider?: ModelProvider;
  }> {
    const { isOnline, latency, geminiApiReachable } = this.connectivityStatus;
    if (isOnline && geminiApiReachable && latency < 2000) {
      if (complexity > 0.7) {
        return this.createRoutingDecision(
          ModelProvider.ONLINE_GEMINI,
          complexity,
          `High complexity (${complexity.toFixed(2)}) with good connectivity (${latency}ms)`,
          ModelProvider.LOCAL_GEMMA3N
        );
      }
    }
    return this.createRoutingDecision(
      ModelProvider.LOCAL_GEMMA3N,
      complexity,
      isOnline
        ? `Low complexity (${complexity.toFixed(2)}) or poor connectivity (${latency}ms)`
        : 'Offline mode detected',
      isOnline && geminiApiReachable ? ModelProvider.ONLINE_GEMINI : undefined
    );
  }
  private createRoutingDecision(
    provider: ModelProvider,
    complexity: number,
    reason: string,
    fallbackProvider?: ModelProvider
  ): {
    selectedProvider: ModelProvider;
    model: string;
    reason: string;
    estimatedResponseTime: number;
    fallbackProvider?: ModelProvider;
  } {
    const model = provider === ModelProvider.ONLINE_GEMINI ? this.ONLINE_MODEL : this.LOCAL_MODEL;
    const estimatedResponseTime = this.estimateResponseTime(provider, complexity);
    return {
      selectedProvider: provider,
      model,
      reason,
      estimatedResponseTime,
      fallbackProvider
    };
  }
  private estimateResponseTime(provider: ModelProvider, complexity: number): number {
    const baseTime = provider === ModelProvider.ONLINE_GEMINI
      ? 1500 + this.connectivityStatus.latency
      : 800;
    return Math.round(baseTime * (1 + complexity * 0.5));
  }
  public calculateComplexity(prompt: string, context?: any): number {
    let complexity = 0.3;
    const lengthFactor = Math.min(prompt.length / 1000, 0.3);
    complexity += lengthFactor;
    const complexKeywords = [
      'analyze', 'compare', 'explain', 'summarize', 'research',
      'code', 'programming', 'algorithm', 'technical', 'detailed',
      'comprehensive', 'complex', 'advanced', 'professional'
    ];
    const keywordMatches = complexKeywords.filter(keyword =>
      prompt.toLowerCase().includes(keyword)
    ).length;
    complexity += (keywordMatches / complexKeywords.length) * 0.3;
    if (context && Object.keys(context).length > 0) {
      complexity += 0.1;
    }
    return Math.min(complexity, 1.0);
  }
  private determineProvider(prompt: string, forceProvider?: LLMProvider): LLMProvider {
    if (forceProvider) {
      return forceProvider;
    }
    if (prompt.includes('[use_local]') || prompt.includes('[use_gemma]')) {
      return 'local';
    }
    return 'local';
    if (!this.networkStatus.isOnline && this.config.preferences.autoSwitchOnOffline) {
      return 'local';
    }
    if (this.config.preferences.useOnlineForComplexQueries && this.isComplexQuery(prompt)) {
      return this.networkStatus.isOnline ? 'online' : 'local';
    }
    return this.config.preferences.preferredProvider;
  }
  private isComplexQuery(prompt: string): boolean {
    const complexityIndicators = [
      'analyze', 'explain in detail', 'comprehensive', 'research',
      'compare', 'contrast', 'pros and cons', 'advantages and disadvantages',
      'step by step', 'tutorial', 'guide', 'how to', 'what is the difference',
      'summarize', 'translate', 'code review', 'debug', 'optimize'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const indicatorCount = complexityIndicators.filter(indicator => 
      lowerPrompt.includes(indicator)
    ).length;
    return indicatorCount >= 2 || prompt.length > 500;
  }
  private getModelForProvider(provider: LLMProvider): LLMModel {
    return 'gemma3n:latest' as LLMModel;
  }
  private async checkConnectivity(): Promise<void> {
    const startTime = Date.now();
    try {
      const isOnline = navigator.onLine;
      if (isOnline) {
        if (!this.isValidApiKey(this.GEMINI_API_KEY)) {
          console.warn('⚠️ [LLM Router] Invalid Gemini API key detected');
          this.connectivityStatus = {
            isOnline: true,
            latency: Date.now() - startTime,
            lastCheck: new Date(),
            geminiApiReachable: false
          };
          return;
        }
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': this.GEMINI_API_KEY
          },
          signal: AbortSignal.timeout(5000)
        });
        const latency = Date.now() - startTime;
        this.connectivityStatus = {
          isOnline: true,
          latency,
          lastCheck: new Date(),
          geminiApiReachable: response.ok
        };
        if (!response.ok) {
          console.warn(`⚠️ [LLM Router] Gemini API not reachable: ${response.status} ${response.statusText}`);
        } else {
          console.log(' [LLM Router] Connectivity check:', this.connectivityStatus);
        }
      } else {
        this.connectivityStatus = {
          isOnline: false,
          latency: 0,
          lastCheck: new Date(),
          geminiApiReachable: false
        };
      }
    } catch (error) {
      console.warn('⚠️ [LLM Router] Connectivity check failed:', error);
      this.connectivityStatus = {
        isOnline: navigator.onLine,
        latency: Date.now() - startTime,
        lastCheck: new Date(),
        geminiApiReachable: false
      };
    }
  }
  private initializeConnectivityMonitoring(): void {
    setInterval(() => {
      this.checkConnectivity();
    }, 30000);
    this.checkConnectivity();
    window.addEventListener('online', () => {
      console.log(' [LLM Router] Network came online');
      this.checkConnectivity();
    });
    window.addEventListener('offline', () => {
      console.log(' [LLM Router] Network went offline');
      this.connectivityStatus.isOnline = false;
      this.connectivityStatus.geminiApiReachable = false;
    });
  }
  private async checkNetworkStatus(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'no-cors'
        });
        clearTimeout(timeoutId);
        this.networkStatus.isOnline = true;
      } catch (error) {
        clearTimeout(timeoutId);
        this.networkStatus.isOnline = false;
      }
      this.networkStatus.lastChecked = new Date();
    } catch (error) {
      console.error('Network status check failed:', error);
      this.networkStatus.isOnline = false;
      this.networkStatus.lastChecked = new Date();
    }
  }
  private initializeNetworkMonitoring(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
      window.addEventListener('online', () => {
        this.networkStatus.isOnline = true;
        this.networkStatus.lastChecked = new Date();
        console.log('Network status: Online');
      });
      window.addEventListener('offline', () => {
        this.networkStatus.isOnline = false;
        this.networkStatus.lastChecked = new Date();
        console.log('Network status: Offline');
      });
    }
    this.networkCheckTimer = setInterval(() => {
      this.checkNetworkStatus();
    }, this.config.networkCheckInterval);
  }
  updatePreferences(preferences: Partial<LLMRoutingPreferences>): void {
    this.config.preferences = { ...this.config.preferences, ...preferences };
    console.log('LLM router preferences updated:', this.config.preferences);
  }
  getPreferences(): LLMRoutingPreferences {
    return { ...this.config.preferences };
  }
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }
  async testConnectivity(): Promise<{
    local: { available: boolean; error?: string };
    online: { available: boolean; error?: string };
  }> {
    const results = {
      local: { available: false, error: undefined as string | undefined },
      online: { available: false, error: undefined as string | undefined }
    };
    try {
      const localResponse = await invoke<boolean>('check_llm_health');
      results.local.available = localResponse;
    } catch (error) {
      results.local.error = error instanceof Error ? error.message : String(error);
    }
    results.online.available = false;
    results.online.error = 'Online API support removed - using local models only';
    return results;
  }
  public setProvider(provider: ModelProvider): void {
    console.log(` [LLM Router] Provider changed: ${this.currentProvider} → ${provider}`);
    this.currentProvider = provider;
  }
  public getCurrentProvider(): ModelProvider {
    return this.currentProvider;
  }
  public getConnectivityStatus(): ConnectivityStatus {
    return { ...this.connectivityStatus };
  }
  destroy(): void {
    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
      this.networkCheckTimer = undefined;
    }
  }
}
export const llmRouter = new LLMRouter();
export default LLMRouter;
