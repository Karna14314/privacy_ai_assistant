import { apiLogger } from './logger';
export interface HardwareInfo {
  cpu_cores: number;
  ram_total_mb: number;
  ram_available_mb: number;
  has_gpu: boolean;
  gpu_name?: string;
  vram_total_mb?: number;
  vram_available_mb?: number;
  platform: string;
}
export interface RuntimeInfo {
  mode: string;
  reason: string;
  ollama_args: string[];
  recommended_models: string[];
}
export interface HardwareSummary {
  hardware: HardwareInfo;
  runtime: RuntimeInfo;
}
export interface ModelPerformance {
  model: string;
  response_time: number;
  success: boolean;
  error?: string;
}
class HardwareOptimizer {
  private static instance: HardwareOptimizer;
  private hardwareInfo: HardwareSummary | null = null;
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private constructor() {}
  public static getInstance(): HardwareOptimizer {
    if (!HardwareOptimizer.instance) {
      HardwareOptimizer.instance = new HardwareOptimizer();
    }
    return HardwareOptimizer.instance;
  }
  public async fetchHardwareInfo(): Promise<HardwareSummary | null> {
    try {
      apiLogger.debug('Fetching hardware information...');
      const response = await fetch('http://127.0.0.1:8000/hardware/info');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get hardware info');
      }
      this.hardwareInfo = data.data;
      apiLogger.info('Hardware information fetched successfully', this.hardwareInfo);
      return this.hardwareInfo;
    } catch (error) {
      apiLogger.error('Failed to fetch hardware information', error as Error);
      return null;
    }
  }
  public async getHardwareInfo(): Promise<HardwareSummary | null> {
    if (!this.hardwareInfo) {
      return await this.fetchHardwareInfo();
    }
    return this.hardwareInfo;
  }
  public getOptimalModels(): string[] {
    if (!this.hardwareInfo) {
      return ['llama3.1:8b'];
    }
    const { hardware, runtime } = this.hardwareInfo;
    if (this.modelPerformance.size > 0) {
      const successfulModels = Array.from(this.modelPerformance.values())
        .filter(p => p.success)
        .sort((a, b) => a.response_time - b.response_time);
      if (successfulModels.length > 0) {
        return [successfulModels[0].model];
      }
    }
    if (runtime.recommended_models && runtime.recommended_models.length > 0) {
      return runtime.recommended_models;
    }
    if (hardware.ram_available_mb < 4000) {
      return ['tinyllama:1.1b', 'phi3:mini'];
    } else if (hardware.ram_available_mb < 8000) {
      return ['gemma3n:2b', 'phi3:mini', 'llama3.1:8b'];
    } else {
      return ['llama3.1:8b', 'qwen2.5:7b', 'gemma3n:latest'];
    }
  }
  public async testModelPerformance(model: string, testPrompt: string = 'Hello'): Promise<ModelPerformance> {
    apiLogger.debug(`Testing performance of model: ${model}`);
    const startTime = performance.now();
    try {
      const response = await fetch('http://127.0.0.1:8000/llm/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: testPrompt,
          model: model,
          stream: false
        })
      });
      const endTime = performance.now();
      const responseTime = (endTime - startTime) / 1000;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Model generation failed');
      }
      const performanceResult: ModelPerformance = {
        model,
        response_time: responseTime,
        success: true
      };
      this.modelPerformance.set(model, performanceResult);
      apiLogger.info(`Model ${model} performance test completed`, performanceResult);
      return performanceResult;
    } catch (error) {
      const performanceResult: ModelPerformance = {
        model,
        response_time: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      this.modelPerformance.set(model, performanceResult);
      apiLogger.error(`Model ${model} performance test failed`, error as Error);
      return performanceResult;
    }
  }
  public getPerformanceRecommendations(): string[] {
    if (!this.hardwareInfo) {
      return ['Hardware information not available. Please check backend connection.'];
    }
    const { hardware, runtime } = this.hardwareInfo;
    const recommendations: string[] = [];
    if (runtime.mode === 'cpu') {
      recommendations.push('️ Running in CPU mode for optimal compatibility');
      recommendations.push(' Consider using smaller models for faster responses');
    } else if (runtime.mode === 'gpu') {
      recommendations.push(' GPU acceleration enabled for faster inference');
      recommendations.push('⚡ Larger models should perform well on this hardware');
    }
    const ramUsagePercent = ((hardware.ram_total_mb - hardware.ram_available_mb) / hardware.ram_total_mb) * 100;
    if (ramUsagePercent > 80) {
      recommendations.push('⚠️ High memory usage detected. Close other applications for better performance');
    } else if (ramUsagePercent < 50) {
      recommendations.push('✅ Sufficient memory available for larger models');
    }
    if (runtime.recommended_models && runtime.recommended_models.length > 0) {
      recommendations.push(` Recommended models for your hardware: ${runtime.recommended_models.join(', ')}`);
    }
    return recommendations;
  }
  public getHardwareStatus(): {
    mode: string;
    performance: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  } {
    if (!this.hardwareInfo) {
      return {
        mode: 'unknown',
        performance: 'poor',
        recommendations: ['Unable to detect hardware configuration']
      };
    }
    const { hardware, runtime } = this.hardwareInfo;
    let performance: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    if (hardware.has_gpu && hardware.vram_total_mb && hardware.vram_total_mb > 8000) {
      performance = 'excellent';
    } else if (hardware.has_gpu && hardware.vram_total_mb && hardware.vram_total_mb > 4000) {
      performance = 'good';
    } else if (hardware.ram_available_mb > 8000 && hardware.cpu_cores >= 8) {
      performance = 'good';
    } else if (hardware.ram_available_mb > 4000 && hardware.cpu_cores >= 4) {
      performance = 'fair';
    } else {
      performance = 'poor';
    }
    return {
      mode: runtime.mode,
      performance,
      recommendations: this.getPerformanceRecommendations()
    };
  }
}
export const hardwareOptimizer = HardwareOptimizer.getInstance();
