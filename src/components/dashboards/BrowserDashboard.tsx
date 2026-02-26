import React, { useState, useEffect } from 'react';
import { X, Globe, Search, ExternalLink, History, Bookmark, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '../../utils/cn';
interface BrowserDashboardProps {
  onClose: () => void;
  onExecute: (data: any) => Promise<{ success: boolean; message: string }>;
}
interface BrowserHistory {
  id: string;
  url: string;
  title: string;
  timestamp: Date;
}
interface Bookmark {
  id: string;
  url: string;
  title: string;
  category: string;
  createdAt: Date;
}
const BrowserDashboard: React.FC<BrowserDashboardProps> = ({ onClose, onExecute }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'history' | 'bookmarks' | 'settings'>('browse');
  const [currentUrl, setCurrentUrl] = useState('https://www.google.com');
  const [searchQuery, setSearchQuery] = useState('');
  const [browserHistory, setBrowserHistory] = useState<BrowserHistory[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  useEffect(() => {
    loadBrowserData();
  }, []);
  const loadBrowserData = () => {
    try {
      const savedHistory = localStorage.getItem('browser_history');
      const savedBookmarks = localStorage.getItem('browser_bookmarks');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setBrowserHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      }
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        setBookmarks(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load browser data:', error);
    }
  };
  const saveBrowserData = () => {
    try {
      localStorage.setItem('browser_history', JSON.stringify(browserHistory));
      localStorage.setItem('browser_bookmarks', JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Failed to save browser data:', error);
    }
  };
  const handleNavigate = async (url: string) => {
    setIsLoading(true);
    setStatus('loading');
    setStatusMessage('Navigating...');
    try {
      const newHistoryItem: BrowserHistory = {
        id: Date.now().toString(),
        url,
        title: `Page at ${url}`,
        timestamp: new Date()
      };
      setBrowserHistory(prev => [newHistoryItem, ...prev.slice(0, 49)]);
      setCurrentUrl(url);
      const result = await onExecute({
        toolData: { action: 'navigate', url },
        context: { currentUrl, history: browserHistory }
      });
      if (result.success) {
        setStatus('success');
        setStatusMessage('Navigation successful');
      } else {
        setStatus('error');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Navigation failed');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };
  const handleSearch = () => {
    if (searchQuery.trim()) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      handleNavigate(searchUrl);
    }
  };
  const addBookmark = () => {
    if (currentUrl.trim()) {
      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        url: currentUrl,
        title: `Bookmark for ${currentUrl}`,
        category: 'General',
        createdAt: new Date()
      };
      setBookmarks(prev => [...prev, newBookmark]);
      saveBrowserData();
    }
  };
  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
    saveBrowserData();
  };
  const clearHistory = () => {
    setBrowserHistory([]);
    saveBrowserData();
  };
  const tabs = [
    { id: 'browse', label: 'Browse', icon: Globe },
    { id: 'history', label: 'History', icon: History },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { id: 'settings', label: 'Settings', icon: RefreshCw }
  ];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Globe size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Web Browser Dashboard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Browse the web and manage your browsing history and bookmarks
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
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            )}
            <span className="text-sm font-medium">{statusMessage}</span>
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
          {activeTab === 'browse' && (
            <div className="space-y-6">
              {}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleNavigate(currentUrl)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
                <input
                  type="text"
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleNavigate(currentUrl)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter URL..."
                />
                <button
                  onClick={() => handleNavigate(currentUrl)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  Go
                </button>
              </div>
              {}
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search the web..."
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                >
                  Search
                </button>
              </div>
              {}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => handleNavigate('https://www.google.com')}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Globe className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  onClick={() => handleNavigate('https://www.github.com')}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Globe className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                  <span className="text-sm font-medium">GitHub</span>
                </button>
                <button
                  onClick={() => handleNavigate('https://www.stackoverflow.com')}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Globe className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                  <span className="text-sm font-medium">Stack Overflow</span>
                </button>
                <button
                  onClick={addBookmark}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Bookmark className="w-6 h-6 mx-auto mb-2 text-red-600" />
                  <span className="text-sm font-medium">Add Bookmark</span>
                </button>
              </div>
              {}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Browser Preview</h3>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                <div className="h-64 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Browser preview would appear here</p>
                    <p className="text-xs mt-1">Current URL: {currentUrl}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Browsing History</h3>
                <button
                  onClick={clearHistory}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear History
                </button>
              </div>
              {browserHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No browsing history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {browserHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.url}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {item.timestamp.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleNavigate(item.url)}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'bookmarks' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Bookmarks</h3>
              {bookmarks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Bookmark className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No bookmarks yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {bookmark.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {bookmark.url}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {bookmark.category} • {bookmark.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleNavigate(bookmark.url)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => removeBookmark(bookmark.id)}
                          className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Browser Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Search Engine
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="google">Google</option>
                    <option value="bing">Bing</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Homepage
                  </label>
                  <input
                    type="text"
                    defaultValue="https://www.google.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter homepage URL"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="clearHistoryOnClose"
                    className="mr-3"
                  />
                  <label htmlFor="clearHistoryOnClose" className="text-sm text-gray-700 dark:text-gray-300">
                    Clear history when closing browser
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableBookmarks"
                    defaultChecked
                    className="mr-3"
                  />
                  <label htmlFor="enableBookmarks" className="text-sm text-gray-700 dark:text-gray-300">
                    Enable bookmarks
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default BrowserDashboard;
