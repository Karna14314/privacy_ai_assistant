import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Upload,
  Download,
  Settings,
  X,
  FileText,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  MessageSquare
} from 'lucide-react';
import { cn } from '../utils/cn';
import { toolMetricsService } from '../services/toolMetricsService';
interface ToolData {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}
interface ToolDashboardProps {
  toolName: string;
  toolIcon: any;
  toolColor: string;
  description: string;
  onClose: () => void;
  onExecute?: (data: any) => Promise<any>;
}
const ToolDashboard: React.FC<ToolDashboardProps> = ({
  toolName,
  toolIcon: IconComponent,
  toolColor,
  description,
  onClose,
  onExecute
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'settings'>('overview');
  const [toolData, setToolData] = useState<ToolData[]>([]);
  const [newDataTitle, setNewDataTitle] = useState('');
  const [newDataContent, setNewDataContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  useEffect(() => {
    loadToolData();
  }, [toolName]);
  const loadToolData = () => {
    try {
      const savedData = localStorage.getItem(`tool_data_${toolName}`);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setToolData(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load tool data:', error);
    }
  };
  const saveToolData = (data: ToolData[]) => {
    try {
      localStorage.setItem(`tool_data_${toolName}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save tool data:', error);
    }
  };
  const handleAddData = () => {
    if (!newDataTitle.trim() || !newDataContent.trim()) {
      setStatus('error');
      setStatusMessage('Please fill in both title and content');
      return;
    }
    const newData: ToolData = {
      id: Date.now().toString(),
      title: newDataTitle.trim(),
      content: newDataContent.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updatedData = [...toolData, newData];
    setToolData(updatedData);
    saveToolData(updatedData);
    setNewDataTitle('');
    setNewDataContent('');
    setStatus('success');
    setStatusMessage('Data added successfully');
    setTimeout(() => setStatus('idle'), 3000);
  };
  const handleDeleteData = (id: string) => {
    const updatedData = toolData.filter(item => item.id !== id);
    setToolData(updatedData);
    saveToolData(updatedData);
  };
  const handleExecuteTool = async () => {
    if (!onExecute) return;
    setIsExecuting(true);
    setStatus('loading');
    setStatusMessage('Executing tool...');
    try {
      const result = await toolMetricsService.recordToolAction(
        toolName,
        'execute',
        async () => await onExecute({
          toolData,
          toolName,
          context: formatToolDataForLLM(toolData)
        })
      );
      setStatus('success');
      setStatusMessage(result?.message || 'Tool executed successfully');
      toolMetricsService.updateHealthStatus({
        toolName,
        isHealthy: true,
        lastCheck: new Date()
      });
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Execution failed');
      toolMetricsService.updateHealthStatus({
        toolName,
        isHealthy: false,
        lastCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 5000);
    } finally {
      setIsExecuting(false);
    }
  };
  const formatToolDataForLLM = (data: ToolData[]): string => {
    if (data.length === 0) return 'No data available for this tool.';
    let formatted = `=== ${toolName.toUpperCase()} DATA ===\n`;
    formatted += `Total items: ${data.length}\n`;
    formatted += `Last updated: ${new Date().toLocaleString()}\n\n`;
    data.forEach((item, index) => {
      formatted += `${index + 1}. ${item.title}\n`;
      formatted += `   Content: ${item.content}\n`;
      formatted += `   Created: ${item.createdAt.toLocaleDateString()}\n`;
      formatted += `   Last Modified: ${item.updatedAt.toLocaleDateString()}\n`;
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        formatted += `   Metadata: ${JSON.stringify(item.metadata)}\n`;
      }
      formatted += '\n';
    });
    formatted += `=== END ${toolName.toUpperCase()} DATA ===`;
    return formatted;
  };
  const handleSendToChat = () => {
    if (toolData.length === 0) {
      setStatus('error');
      setStatusMessage('No data to send to chat');
      return;
    }
    const contextMessage = `Here's the data from my ${toolName}:\n\n${formatToolDataForLLM(toolData)}`;
    navigator.clipboard.writeText(contextMessage);
    setStatus('success');
    setStatusMessage('Tool data copied to clipboard - paste in chat to use');
    setTimeout(() => setStatus('idle'), 3000);
  };
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={cn("p-2 rounded-lg", `bg-${toolColor}-100 dark:bg-${toolColor}-900/30`)}>
              <IconComponent size={24} className={toolColor} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {toolName} Dashboard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        {}
        {status !== 'idle' && (
          <div className={cn(
            "px-6 py-3 flex items-center space-x-2 transition-all duration-300",
            status === 'success' && "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
            status === 'error' && "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
            status === 'loading' && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
          )}>
            {status === 'success' && <CheckCircle size={16} />}
            {status === 'error' && <AlertCircle size={16} />}
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            )}
            <span className="text-sm font-medium">{statusMessage}</span>
            {status === 'success' && (
              <div className="ml-auto">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        )}
        {}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Database size={20} className="text-blue-600" />
                    <span className="font-medium">Data Items</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{toolData.length}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Activity size={20} className="text-green-600" />
                    <span className="font-medium">Status</span>
                  </div>
                  <p className="text-lg font-semibold mt-2 text-green-600">Active</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <FileText size={20} className="text-purple-600" />
                    <span className="font-medium">Last Updated</span>
                  </div>
                  <p className="text-sm mt-2">
                    {toolData.length > 0 
                      ? new Date(Math.max(...toolData.map(d => d.updatedAt.getTime()))).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleExecuteTool}
                  disabled={isLoading || !onExecute}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Activity size={16} />
                  <span>{isLoading ? 'Executing...' : 'Execute Tool'}</span>
                </button>
                <button
                  onClick={handleSendToChat}
                  disabled={toolData.length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={16} />
                  <span>Send to Chat</span>
                </button>
              </div>
            </div>
          )}
          {activeTab === 'data' && (
            <div className="space-y-6">
              {}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                  <Plus size={20} />
                  <span>Add New Data</span>
                </h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Data title..."
                    value={newDataTitle}
                    onChange={(e) => setNewDataTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <textarea
                    placeholder="Data content..."
                    value={newDataContent}
                    onChange={(e) => setNewDataContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleAddData}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save size={16} />
                    <span>Save Data</span>
                  </button>
                </div>
              </div>
              {}
              <div>
                <h3 className="text-lg font-medium mb-4">Saved Data</h3>
                {toolData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Database size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No data saved yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {toolData.map(item => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.content}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Created: {item.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteData(item.id)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Tool Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tool Name
                    </label>
                    <input
                      type="text"
                      value={toolName}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      disabled
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ToolDashboard;
