import { invoke } from '@tauri-apps/api/core';
export interface ToolUsageMetric {
  toolName: string;
  action: string;
  timestamp: Date;
  success: boolean;
  executionTime: number;
  metadata?: Record<string, any>;
}
export interface ToolHealthStatus {
  toolName: string;
  isHealthy: boolean;
  lastCheck: Date;
  errorMessage?: string;
}
export interface ToolMetricsData {
  toolName: string;
  totalUsage: number;
  successRate: number;
  averageExecutionTime: number;
  lastUsed: Date | null;
  isActive: boolean;
  healthStatus: ToolHealthStatus;
}
class ToolMetricsService {
  private metrics: Map<string, ToolUsageMetric[]> = new Map();
  private healthStatus: Map<string, ToolHealthStatus> = new Map();
  private listeners: Set<(metrics: Map<string, ToolMetricsData>) => void> = new Set();
  constructor() {
    this.initializeMetrics();
  }
  private initializeMetrics() {
    const knownTools = [
      'file_reader',
      'file_writer', 
      'note_taker',
      'todo_list',
      'browser_integration',
      'plugin_inspector'
    ];
    knownTools.forEach(tool => {
      this.metrics.set(tool, []);
      this.healthStatus.set(tool, {
        toolName: tool,
        isHealthy: true,
        lastCheck: new Date()
      });
    });
  }
  public recordUsage(metric: ToolUsageMetric): void {
    const toolMetrics = this.metrics.get(metric.toolName) || [];
    toolMetrics.push(metric);
    if (toolMetrics.length > 100) {
      toolMetrics.splice(0, toolMetrics.length - 100);
    }
    this.metrics.set(metric.toolName, toolMetrics);
    this.notifyListeners();
    console.log(` [Tool Metrics] Recorded usage for ${metric.toolName}: ${metric.action}`);
  }
  public updateHealthStatus(status: ToolHealthStatus): void {
    this.healthStatus.set(status.toolName, status);
    this.notifyListeners();
    console.log(` [Tool Health] Updated ${status.toolName}: ${status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
  }
  public getToolMetrics(toolName: string): ToolMetricsData | null {
    const usageMetrics = this.metrics.get(toolName) || [];
    const health = this.healthStatus.get(toolName);
    if (!health) {
      return null;
    }
    const totalUsage = usageMetrics.length;
    const successfulUsage = usageMetrics.filter(m => m.success).length;
    const successRate = totalUsage > 0 ? (successfulUsage / totalUsage) * 100 : 0;
    const executionTimes = usageMetrics.map(m => m.executionTime);
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    const lastUsed = usageMetrics.length > 0 
      ? usageMetrics[usageMetrics.length - 1].timestamp 
      : null;
    const isActive = lastUsed ? (Date.now() - lastUsed.getTime()) < 300000 : false;
    return {
      toolName,
      totalUsage,
      successRate,
      averageExecutionTime,
      lastUsed,
      isActive,
      healthStatus: health
    };
  }
  public getAllMetrics(): Map<string, ToolMetricsData> {
    const allMetrics = new Map<string, ToolMetricsData>();
    for (const toolName of this.metrics.keys()) {
      const metrics = this.getToolMetrics(toolName);
      if (metrics) {
        allMetrics.set(toolName, metrics);
      }
    }
    return allMetrics;
  }
  public subscribe(listener: (metrics: Map<string, ToolMetricsData>) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllMetrics());
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notifyListeners(): void {
    const allMetrics = this.getAllMetrics();
    this.listeners.forEach(listener => {
      try {
        listener(allMetrics);
      } catch (error) {
        console.error('Error notifying metrics listener:', error);
      }
    });
  }
  public async syncWithBackend(): Promise<void> {
    try {
      console.log(' [Tool Metrics] Syncing with backend...');
      const backendMetrics = await invoke('get_tool_metrics') as any;
      if (backendMetrics && backendMetrics.metrics) {
        const { metrics } = backendMetrics;
        if (metrics.tool_usage_count) {
          Object.entries(metrics.tool_usage_count).forEach(([toolName, count]) => {
            const currentMetrics = this.metrics.get(toolName) || [];
            while (currentMetrics.length < (count as number)) {
              currentMetrics.push({
                toolName,
                action: 'sync_placeholder',
                timestamp: new Date(),
                success: true,
                executionTime: metrics.average_execution_time_ms || 0
              });
            }
            this.metrics.set(toolName, currentMetrics);
          });
        }
        if (backendMetrics.plugin_health) {
          Object.entries(backendMetrics.plugin_health).forEach(([toolName, isHealthy]) => {
            this.updateHealthStatus({
              toolName,
              isHealthy: isHealthy as boolean,
              lastCheck: new Date()
            });
          });
        }
      }
      console.log('✅ [Tool Metrics] Backend sync completed');
    } catch (error) {
      console.error('❌ [Tool Metrics] Backend sync failed:', error);
    }
  }
  public startPeriodicSync(intervalMs: number = 30000): void {
    this.syncWithBackend();
    setInterval(() => {
      this.syncWithBackend();
    }, intervalMs);
    console.log(` [Tool Metrics] Started periodic sync every ${intervalMs}ms`);
  }
  public async recordToolAction<T>(
    toolName: string, 
    action: string, 
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let result: T;
    try {
      result = await operation();
      success = true;
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      this.recordUsage({
        toolName,
        action,
        timestamp: new Date(),
        success,
        executionTime,
        metadata
      });
    }
  }
}
export const toolMetricsService = new ToolMetricsService();
toolMetricsService.startPeriodicSync();
export default ToolMetricsService;
