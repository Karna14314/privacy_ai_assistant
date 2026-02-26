import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import EnhancedChatInterface from './components/EnhancedChatInterface';
import BrowserModeBlocker from './components/BrowserModeBlocker';
import StartupDiagnostic from './components/StartupDiagnostic';
import ErrorBoundary from './components/ErrorBoundary';
import EnhancedSidebar from './components/EnhancedSidebar';
import { AppInitializingLoader } from './components/LoadingStates';
import { FullScreenError } from './components/ErrorStates';
import { useAppStore } from './stores/chatStore';
import { useSettingsStore } from './stores/settingsStore';
import { useEnhancedChatStore } from './stores/enhancedChatStore';
import { cn } from './utils/cn';
import './styles/globals.css';
import './styles/animations.css';
import { SystemInfo, AppVersion } from './types';
import { ensureEnvironment, EnvironmentCapabilities, TAURI_ENV } from './utils/tauriDetection';
import { appLogger, tauriLogger } from './utils/logger';
type AppState = 'initializing' | 'diagnostics' | 'ready' | 'browser_mode' | 'error';
const App: React.FC = () => {
  const { setSystemInfo, setAppVersion, setInitialized } = useAppStore();
  const { loadSettings } = useSettingsStore();
  const { initializeStore } = useEnhancedChatStore();
  const [appState, setAppState] = useState<AppState>('initializing');
  const [error, setError] = useState<string | null>(null);
  const handleError = (error: Error, context: string) => {
    appLogger.error(`Error in ${context}`, error);
    setError(`${context}: ${error.message}`);
    setAppState('error');
  };
  useEffect(() => {
    const initializeApp = async () => {
      try {
        appLogger.info('Initializing application...');
        appLogger.debug('Checking synchronous Tauri detection...');
        let env = TAURI_ENV;
        if (env.isTauri) {
          tauriLogger.info('Synchronous detection found Tauri environment, confirming...');
          try {
            const asyncEnv = await Promise.race([
              ensureEnvironment(),
              new Promise<EnvironmentCapabilities>((resolve) =>
                setTimeout(() => resolve(env), 1000)
              )
            ]);
            env = asyncEnv;
          } catch (error) {
            tauriLogger.warn('Async detection failed, using synchronous result', error);
          }
        }
        if (env.isBrowser) {
          appLogger.warn('Running in browser mode.');
          setAppState('browser_mode');
          return;
        }
        if (!env.hasInvoke) {
          tauriLogger.warn('Tauri environment detected, but invoke is not ready yet. Proceeding with diagnostics...');
        }
        tauriLogger.info('Tauri environment confirmed. Running diagnostics...');
        setAppState('diagnostics');
        const systemInfo = await invoke<SystemInfo>('get_system_info');
        setSystemInfo(systemInfo);
        const appVersion = await invoke<AppVersion>('get_app_version');
        setAppVersion(appVersion);
        await invoke('log_message', { message: 'App environment initialized.' });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        handleError(error, 'App Initialization');
      }
    };
    initializeApp();
  }, [setSystemInfo, setAppVersion]);
  const handleDiagnosticComplete = (success: boolean) => {
    if (success) {
      console.log('✅ Diagnostics passed. Application is ready.');
      setInitialized(true);
      setAppState('ready');
    } else {
      console.warn('⚠️ Diagnostics failed. App will have limited functionality.');
      setInitialized(true);
      setAppState('ready');
    }
  };
  const renderContent = () => {
    switch (appState) {
      case 'initializing':
        return <AppInitializingLoader />;
      case 'diagnostics':
        return (
          <StartupDiagnostic
            onDiagnosticComplete={handleDiagnosticComplete}
          />
        );
      case 'ready':
        return (
          <>
            <EnhancedSidebar />
            <div className="lg:ml-80">
              <EnhancedChatInterface />
            </div>
          </>
        );
      case 'browser_mode':
        return <BrowserModeBlocker onIgnoreWarning={() => setAppState('ready')} />;
      case 'error':
        return (
          <FullScreenError
            title="Application Error"
            message={error || 'An unexpected error occurred'}
            onRetry={() => {
              setError(null);
              setAppState('initializing');
            }}
          />
        );
      default:
        return (
          <FullScreenError
            title="Invalid Application State"
            message="The application is in an unknown state. Please reload the app."
          />
        );
    }
  };
  return (
    <ErrorBoundary>
      <div className={cn(
        'h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
        'transition-colors duration-300'
      )}>
        <main className="h-full">
          {renderContent()}
        </main>
      </div>
    </ErrorBoundary>
  );
};
export default App;
