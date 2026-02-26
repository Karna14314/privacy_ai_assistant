import React from 'react';
import { AlertTriangle, Monitor, Terminal, ExternalLink } from 'lucide-react';
import { getTauriStatus } from '../utils/tauriDetection';
interface BrowserModeBlockerProps {
  onIgnoreWarning?: () => void;
}
export const BrowserModeBlocker: React.FC<BrowserModeBlockerProps> = ({
  onIgnoreWarning
}) => {
  const tauriStatus = getTauriStatus();
  if (tauriStatus.status === 'connected' || tauriStatus.status === 'checking') {
    return null;
  }
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isDevPort = window.location.port === '5174' || window.location.port === '5173';
  if (isLocalhost && isDevPort && onIgnoreWarning) {
    console.log(' Development mode detected, bypassing browser mode blocker');
    setTimeout(() => onIgnoreWarning(), 100);
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <AlertTriangle className="w-16 h-16 text-red-500" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">!</span>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Desktop Mode Required
          </h1>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200 font-medium">
              {tauriStatus.message}
            </p>
          </div>
          <div className="text-left mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              ️ How to Fix:
            </h3>
            <div className="space-y-3">
              {(tauriStatus.recommendations || []).map((rec, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-800 dark:text-blue-200 font-medium">
                Correct Launch Command:
              </span>
            </div>
            <div className="bg-gray-900 dark:bg-gray-700 rounded-md p-3 font-mono text-sm">
              <span className="text-green-400">$</span>
              <span className="text-white ml-2">npm run dev</span>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              This launches the full Tauri desktop app with all features
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Monitor className="w-4 h-4" />
              <span>Privacy AI Assistant requires desktop environment for:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
              <li>Local LLM (Gemma 3n) integration</li>
              <li>Voice recognition (Vosk STT)</li>
              <li>Text-to-speech (Piper TTS)</li>
              <li>File system access</li>
              <li>Offline model execution</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Refresh Page</span>
            </button>
            {onIgnoreWarning && (
              <button
                type="button"
                onClick={onIgnoreWarning}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Continue Anyway (Limited Mode)
              </button>
            )}
          </div>
          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            <p>
              If you're seeing this in the desktop app, please restart the application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BrowserModeBlocker;
