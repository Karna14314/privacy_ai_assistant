import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Package,
  ChevronDown,
  ChevronRight,
  Tag,
  Settings
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Plugin } from '../types';
import { pluginRegistry } from '../core/plugins/registry';
import { useAppStore } from '../stores/chatStore';
interface PluginPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
interface PluginItemProps {
  plugin: Plugin;
  isEnabled: boolean;
  onToggle: (pluginName: string, enabled: boolean) => void;
}
const PluginItem: React.FC<PluginItemProps> = ({ plugin, isEnabled, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      {}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {plugin.manifest.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              v{plugin.manifest.version}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {}
          <div className={cn(
            "w-2 h-2 rounded-full",
            isEnabled ? "bg-green-500" : "bg-gray-400"
          )} />
          {}
          <button
            type="button"
            onClick={() => onToggle(plugin.manifest.name, !isEnabled)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isEnabled ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                isEnabled ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>
      {}
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {plugin.manifest.description}
      </p>
      {}
      <div className="flex flex-wrap gap-1">
        {plugin.manifest.triggerWords.slice(0, 3).map((keyword, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          >
            <Tag className="w-3 h-3 mr-1" />
            {keyword}
          </span>
        ))}
        {plugin.manifest.triggerWords.length > 3 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            +{plugin.manifest.triggerWords.length - 3} more
          </span>
        )}
      </div>
      {}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span>Details</span>
        </button>
        {isExpanded && (
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Category:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{plugin.manifest.category}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Author:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{plugin.manifest.author}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">All Keywords:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {plugin.manifest.triggerWords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            {plugin.manifest.examples && plugin.manifest.examples.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Examples:</span>
                <ul className="mt-1 space-y-1">
                  {plugin.manifest.examples.slice(0, 2).map((example, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-400 text-xs">
                      • {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
const PluginPanel: React.FC<PluginPanelProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [filteredPlugins, setFilteredPlugins] = useState<Plugin[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { pluginsEnabled, setPluginsEnabled } = useAppStore();
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
  useEffect(() => {
    const loadedPlugins = pluginRegistry.getAll();
    setPlugins(loadedPlugins);
    setFilteredPlugins(loadedPlugins);
    const savedEnabledPlugins = localStorage.getItem('enabledPlugins');
    if (savedEnabledPlugins) {
      setEnabledPlugins(new Set(JSON.parse(savedEnabledPlugins)));
    } else {
      setEnabledPlugins(new Set(loadedPlugins.map(p => p.manifest.name)));
    }
  }, []);
  useEffect(() => {
    let filtered = plugins;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(plugin =>
        plugin.manifest.name.toLowerCase().includes(term) ||
        plugin.manifest.description.toLowerCase().includes(term) ||
        plugin.manifest.triggerWords.some(keyword => keyword.toLowerCase().includes(term)) ||
        plugin.manifest.category.toLowerCase().includes(term)
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(plugin => plugin.manifest.category === selectedCategory);
    }
    setFilteredPlugins(filtered);
  }, [plugins, searchTerm, selectedCategory]);
  const categories = ['all', ...Array.from(new Set(plugins.map(p => p.manifest.category)))];
  const handlePluginToggle = (pluginName: string, enabled: boolean) => {
    const newEnabledPlugins = new Set(enabledPlugins);
    if (enabled) {
      newEnabledPlugins.add(pluginName);
    } else {
      newEnabledPlugins.delete(pluginName);
    }
    setEnabledPlugins(newEnabledPlugins);
    localStorage.setItem('enabledPlugins', JSON.stringify(Array.from(newEnabledPlugins)));
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      {}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      {}
      <div className="relative ml-auto w-96 h-full bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Plugin Manager
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {}
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
          {}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Plugins
            </span>
            <button
              type="button"
              onClick={() => setPluginsEnabled(!pluginsEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                pluginsEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  pluginsEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          {}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPlugins.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {plugins.length === 0 ? 'No plugins loaded' : 'No plugins match your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPlugins.map(plugin => (
                <PluginItem
                  key={plugin.manifest.name}
                  plugin={plugin}
                  isEnabled={enabledPlugins.has(plugin.manifest.name)}
                  onToggle={handlePluginToggle}
                />
              ))}
            </div>
          )}
        </div>
        {}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{filteredPlugins.length} of {plugins.length} plugins</span>
            <span>{enabledPlugins.size} enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PluginPanel;
