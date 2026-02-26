import { Plugin } from '../../types';
import { PluginRegistryInterface } from './types';
class PluginRegistry implements PluginRegistryInterface {
  private plugins: Map<string, Plugin> = new Map();
  register(plugin: Plugin): void {
    if (!plugin.manifest?.name) {
      throw new Error('Plugin must have a valid manifest with a name');
    }
    if (this.plugins.has(plugin.manifest.name)) {
      console.warn(`Plugin ${plugin.manifest.name} is already registered. Overwriting...`);
    }
    this.plugins.set(plugin.manifest.name, plugin);
    console.log(`Plugin registered: ${plugin.manifest.name}`);
  }
  unregister(pluginName: string): void {
    if (this.plugins.has(pluginName)) {
      this.plugins.delete(pluginName);
      console.log(`Plugin unregistered: ${pluginName}`);
    } else {
      console.warn(`Plugin ${pluginName} not found in registry`);
    }
  }
  get(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  findByKeyword(keyword: string): Plugin[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(plugin => 
      plugin.manifest.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
      plugin.manifest.triggerWords.some(t => t.toLowerCase().includes(lowerKeyword))
    );
  }
  clear(): void {
    this.plugins.clear();
    console.log('Plugin registry cleared');
  }
  count(): number {
    return this.plugins.size;
  }
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
  getByCategory(category: string): Plugin[] {
    return this.getAll().filter(plugin => 
      plugin.manifest.category === category
    );
  }
}
export const pluginRegistry = new PluginRegistry();
export default PluginRegistry;
