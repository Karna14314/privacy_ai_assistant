import { Plugin, PluginManifest, PluginResult, PluginContext } from '../../types';
export interface BasePlugin {
  manifest: PluginManifest;
  run: (input: string, context?: PluginContext) => Promise<PluginResult>;
}
export interface ExtendedPluginContext extends PluginContext {
  pluginName: string;
  executionId: string;
  startTime: Date;
  userInput: string;
}
export interface PluginDetectionResult {
  shouldExecute: boolean;
  pluginName: string;
  confidence: number;
  matchedKeywords: string[];
  extractedInput: string;
}
export interface PluginExecutionResult extends PluginResult {
  pluginName: string;
  executionTime: number;
  context: ExtendedPluginContext;
}
export interface PluginLoader {
  loadPlugin: (pluginPath: string) => Promise<Plugin>;
  loadAllPlugins: () => Promise<Plugin[]>;
  validatePlugin: (plugin: Plugin) => boolean;
}
export interface PluginRegistryInterface {
  register: (plugin: Plugin) => void;
  unregister: (pluginName: string) => void;
  get: (pluginName: string) => Plugin | undefined;
  getAll: () => Plugin[];
  findByKeyword: (keyword: string) => Plugin[];
  clear: () => void;
}
export interface PluginRunnerConfig {
  maxExecutionTime: number;
  enableLogging: boolean;
  fallbackToLLM: boolean;
  keywordMatchThreshold: number;
}
export default BasePlugin;
