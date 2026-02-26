import React, { useState, useRef, useEffect } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RefreshCw, 
  Home, 
  Bookmark, 
  Search,
  X,
  ExternalLink,
  Shield,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { invoke } from '@tauri-apps/api/core';
interface EmbeddedBrowserProps {
  className?: string;
  isVisible?: boolean;
  onToggle?: () => void;
  onContentExtracted?: (content: any) => void;
}
interface BrowserState {
  currentUrl: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isSecure: boolean;
  error: string | null;
}
interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}
export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  className,
  isVisible = false,
  onToggle,
  onContentExtracted
}) => {
  const [browserState, setBrowserState] = useState<BrowserState>({
    currentUrl: '',
    title: 'New Tab',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isSecure: false,
    error: null
  });
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([
    'https://wikipedia.org',
    'https://duckduckgo.com',
    'https://github.com'
  ]);
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const browserRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const handleNavigate = async (url: string) => {
    if (!url) return;
    setBrowserState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const validUrl = new URL(url);
      setBrowserState(prev => ({
        ...prev,
        currentUrl: url,
        title: validUrl.hostname,
        isSecure: url.startsWith('https://'),
        isLoading: false,
        canGoBack: true
      }));
      setUrlInput(url);
      try {
        await extractPageContent(url);
      } catch (extractError) {
        console.warn('Content extraction failed, continuing with navigation:', extractError);
      }
    } catch (error) {
      console.error('Navigation failed:', error);
      setBrowserState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  };
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      console.log(' Searching for:', query);
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      const mockResults: SearchResult[] = [
        {
          title: `Search results for "${query}"`,
          snippet: `Find information about ${query} on DuckDuckGo`,
          url: searchUrl,
          source: 'DuckDuckGo'
        },
        {
          title: `Wikipedia: ${query}`,
          snippet: `Learn more about ${query} on Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          source: 'Wikipedia'
        }
      ];
      console.log('✅ Search results:', mockResults);
      setSearchResults(mockResults);
      await handleNavigate(searchUrl);
    } catch (error) {
      console.error('Search failed:', error);
      setBrowserState(prev => ({
        ...prev,
        error: `Search failed: ${error}`
      }));
    } finally {
      setIsSearching(false);
    }
  };
  const extractPageContent = async (url: string) => {
    try {
      console.log(' Extracting content from:', url);
      let content;
      try {
        content = await invoke('extract_page_content', { url });
      } catch (tauriError) {
        content = {
          url,
          title: new URL(url).hostname,
          text: `Content from ${url}`,
          timestamp: new Date().toISOString()
        };
      }
      console.log('✅ Content extracted:', content);
      if (onContentExtracted) {
        onContentExtracted(content);
      }
    } catch (error) {
      console.warn('Content extraction failed:', error);
    }
  };
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = `https://${url}`;
      } else {
        handleSearch(url);
        return;
      }
    }
    handleNavigate(url);
  };
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };
  const addBookmark = () => {
    if (browserState.currentUrl && !bookmarks.includes(browserState.currentUrl)) {
      setBookmarks(prev => [...prev, browserState.currentUrl]);
    }
  };
  const removeBookmark = (url: string) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark !== url));
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(800, e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  if (!isVisible) return null;
  return (
    <div 
      className={cn(
        'fixed right-0 top-0 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-30 flex flex-col',
        className
      )}
      style={{ width: `${width}px` }}
      ref={browserRef}
    >
      {}
      <div
        ref={resizeRef}
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 transition-colors"
        onMouseDown={handleMouseDown}
      />
      {}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-blue-600" />
          <span className="font-medium text-sm">Browser</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Close browser"
        >
          <X size={16} />
        </button>
      </div>
      {}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {}}
            disabled={!browserState.canGoBack}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={() => {}}
            disabled={!browserState.canGoForward}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go forward"
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => browserState.currentUrl && handleNavigate(browserState.currentUrl)}
            disabled={browserState.isLoading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={browserState.isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => handleNavigate('https://wikipedia.org')}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            title="Home"
          >
            <Home size={16} />
          </button>
        </div>
        {}
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL or search..."
              className="w-full px-3 py-2 pl-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
              {browserState.isSecure ? (
                <Shield size={14} className="text-green-500" />
              ) : (
                <AlertTriangle size={14} className="text-yellow-500" />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={addBookmark}
            disabled={!browserState.currentUrl}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
            title="Bookmark"
          >
            <Bookmark size={14} />
          </button>
        </form>
        {}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the web..."
              className="w-full px-3 py-2 pl-8 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </form>
      </div>
      {}
      <div className="flex-1 overflow-auto">
        {}
        {browserState.error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle size={16} />
              <span className="text-sm">{browserState.error}</span>
            </div>
          </div>
        )}
        {}
        {searchResults.length > 0 && (
          <div className="p-4">
            <h3 className="font-medium text-sm mb-3">Search Results</h3>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => handleNavigate(result.url)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate">
                        {result.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {result.snippet}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500 truncate">{result.url}</span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {result.source}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {}
        {bookmarks.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-sm mb-3">Bookmarks</h3>
            <div className="space-y-2">
              {bookmarks.map((bookmark, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                >
                  <button
                    onClick={() => handleNavigate(bookmark)}
                    className="flex-1 text-left text-sm text-blue-600 dark:text-blue-400 truncate"
                  >
                    {new URL(bookmark).hostname}
                  </button>
                  <button
                    onClick={() => removeBookmark(bookmark)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Remove bookmark"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {}
        {browserState.currentUrl && !browserState.error && (
          <div className="flex-1 border-t border-gray-200 dark:border-gray-700 browser-iframe-container">
            <iframe
              src={browserState.currentUrl}
              className="w-full h-full border-0 browser-iframe-container"
              title={browserState.title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => {
                console.log('✅ Browser iframe loaded:', browserState.currentUrl);
                setBrowserState(prev => ({ ...prev, isLoading: false }));
              }}
              onError={(e) => {
                console.error('❌ Browser iframe error:', e);
                setBrowserState(prev => ({
                  ...prev,
                  isLoading: false,
                  error: 'Failed to load page'
                }));
              }}
            />
          </div>
        )}
        {}
        {browserState.isLoading && (
          <div className="flex-1 flex items-center justify-center border-t border-gray-200 dark:border-gray-700 browser-iframe-container">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading page...</p>
            </div>
          </div>
        )}
        {}
        {browserState.error && (
          <div className="flex-1 flex items-center justify-center border-t border-gray-200 dark:border-gray-700 browser-iframe-container">
            <div className="text-center">
              <div className="text-red-500 mb-2">⚠️</div>
              <p className="text-sm text-red-600 dark:text-red-400">{browserState.error}</p>
              <button
                type="button"
                onClick={() => browserState.currentUrl && handleNavigate(browserState.currentUrl)}
                className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {}
        {browserState.currentUrl && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-between mb-1">
                <span>Current page:</span>
                <span className={browserState.isSecure ? 'text-green-600' : 'text-yellow-600'}>
                  {browserState.isSecure ? 'Secure' : 'Not secure'}
                </span>
              </div>
              <div className="truncate">{browserState.title}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default EmbeddedBrowser;
