import { Plugin } from '../../types';
import { PluginDetectionResult } from './types';
import { pluginRegistry } from './registry';
export class PluginDetector {
  private keywordMatchThreshold: number = 0.6;
  constructor(threshold: number = 0.6) {
    this.keywordMatchThreshold = threshold;
  }
  detectPlugin(input: string): PluginDetectionResult | null {
    const normalizedInput = input.toLowerCase().trim();
    const plugins = pluginRegistry.getAll();
    let bestMatch: PluginDetectionResult | null = null;
    let highestConfidence = 0;
    for (const plugin of plugins) {
      const result = this.analyzePluginMatch(plugin, normalizedInput);
      if (result.shouldExecute && result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        bestMatch = result;
      }
    }
    return bestMatch;
  }
  private analyzePluginMatch(plugin: Plugin, normalizedInput: string): PluginDetectionResult {
    const manifest = plugin.manifest;
    const matchedKeywords: string[] = [];
    let totalMatches = 0;
    let totalPossibleMatches = 0;
    for (const triggerWord of manifest.triggerWords) {
      totalPossibleMatches += 2;
      const normalizedTrigger = triggerWord.toLowerCase();
      if (normalizedInput.includes(normalizedTrigger)) {
        matchedKeywords.push(triggerWord);
        totalMatches += 2;
      }
    }
    for (const keyword of manifest.keywords) {
      totalPossibleMatches += 1;
      const normalizedKeyword = keyword.toLowerCase();
      if (normalizedInput.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        totalMatches += 1;
      }
    }
    const confidence = totalPossibleMatches > 0 ? totalMatches / totalPossibleMatches : 0;
    const shouldExecute = confidence >= this.keywordMatchThreshold && matchedKeywords.length > 0;
    const extractedInput = this.extractRelevantInput(normalizedInput, matchedKeywords);
    return {
      shouldExecute,
      pluginName: manifest.name,
      confidence,
      matchedKeywords,
      extractedInput
    };
  }
  private extractRelevantInput(input: string, matchedKeywords: string[]): string {
    let cleanedInput = input;
    for (const keyword of matchedKeywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
      cleanedInput = cleanedInput.replace(regex, '').trim();
    }
    cleanedInput = cleanedInput.replace(/^(please|can you|could you|help me|i want to|i need to)\s+/i, '');
    return cleanedInput.trim();
  }
  getPotentialMatches(input: string): PluginDetectionResult[] {
    const normalizedInput = input.toLowerCase().trim();
    const plugins = pluginRegistry.getAll();
    const results: PluginDetectionResult[] = [];
    for (const plugin of plugins) {
      const result = this.analyzePluginMatch(plugin, normalizedInput);
      if (result.confidence > 0) {
        results.push(result);
      }
    }
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  setThreshold(threshold: number): void {
    this.keywordMatchThreshold = Math.max(0, Math.min(1, threshold));
  }
  getThreshold(): number {
    return this.keywordMatchThreshold;
  }
}
export const pluginDetector = new PluginDetector();
export default PluginDetector;
