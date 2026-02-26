import { core } from '@tauri-apps/api';
declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
    __TAURI_INVOKE__?: any;
  }
}
export interface EnvironmentCapabilities {
  isTauri: boolean;
  isBrowser: boolean;
  hasInvoke: boolean;
}
let environmentPromise: Promise<EnvironmentCapabilities> | null = null;
async function detectEnvironment(timeout = 2000): Promise<EnvironmentCapabilities> {
  if (typeof window === 'undefined') {
    return { isTauri: false, isBrowser: false, hasInvoke: false };
  }
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkTauri = () => {
      if (window.__TAURI__) {
        console.log(`✅ Tauri environment detected after ${Date.now() - startTime}ms.`);
        resolve({
          isTauri: true,
          isBrowser: false,
          hasInvoke: typeof core.invoke === 'function',
        });
      } else if (Date.now() - startTime > timeout) {
        console.warn(`⚠️ Timed out waiting for Tauri environment. Assuming browser mode.`);
        resolve({ isTauri: false, isBrowser: true, hasInvoke: false });
      } else {
        setTimeout(checkTauri, 50);
      }
    };
    checkTauri();
  });
}
export function ensureEnvironment(): Promise<EnvironmentCapabilities> {
  if (!environmentPromise) {
    environmentPromise = detectEnvironment();
  }
  return environmentPromise;
}
export const useEnvironment = (): EnvironmentCapabilities => {
  const [env, setEnv] = React.useState<EnvironmentCapabilities>({
    isTauri: false,
    isBrowser: true,
    hasInvoke: false,
  });
  React.useEffect(() => {
    ensureEnvironment().then(setEnv);
  }, []);
  return env;
};
let React: typeof import('react');
try {
  React = require('react');
} catch (e) {
}
export const TAURI_ENV: EnvironmentCapabilities = (() => {
  if (typeof window === 'undefined') {
    return { isTauri: false, isBrowser: false, hasInvoke: false };
  }
  const hasTauriGlobal = !!window.__TAURI__;
  const isTauriProtocol = window.location.protocol === 'tauri:';
  const hasTauriUserAgent = navigator.userAgent.includes('Tauri') || navigator.userAgent.includes('wry');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isDevPort = window.location.port === '5174' || window.location.port === '5173';
  const hasTauriWindow = !!(window as any).__TAURI_INTERNALS__;
  const hasTauriAPI = !!(window as any).__TAURI_INVOKE__;
  const isDevelopmentTauri = isLocalhost && isDevPort && (hasTauriGlobal || hasTauriUserAgent || hasTauriWindow || hasTauriAPI);
  const isLikelyTauriDev = isLocalhost && isDevPort;
  const isDevelopmentMode = isLocalhost && (isDevPort || window.location.port === '5174');
  const isTauri = hasTauriGlobal || isTauriProtocol || isDevelopmentTauri || isLikelyTauriDev || isDevelopmentMode;
  console.log(' Tauri Detection:', {
    hasTauriGlobal,
    isTauriProtocol,
    hasTauriUserAgent,
    hasTauriWindow,
    hasTauriAPI,
    isLocalhost,
    isDevPort,
    isDevelopmentTauri,
    isLikelyTauriDev,
    finalIsTauri: isTauri,
    userAgent: navigator.userAgent,
    location: window.location.href,
  });
  const hasInvoke = isTauri && (
    (hasTauriGlobal && typeof core.invoke === 'function') ||
    isDevelopmentMode
  );
  return {
    isTauri,
    isBrowser: !isTauri,
    hasInvoke,
  };
})();
export interface TauriStatus {
  status: 'connected' | 'disconnected' | 'checking';
  message?: string;
  capabilities?: EnvironmentCapabilities;
  recommendations?: string[];
}
export function getTauriStatus(): TauriStatus {
  const capabilities = TAURI_ENV;
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isDevPort = typeof window !== 'undefined' &&
    (window.location.port === '5174' || window.location.port === '5173');
  const isDevelopmentMode = isLocalhost && isDevPort;
  if (isDevelopmentMode && capabilities.isTauri) {
    return {
      status: 'connected',
      message: 'Tauri development environment ready',
      capabilities,
      recommendations: [],
    };
  }
  if (capabilities.isTauri && capabilities.hasInvoke) {
    return {
      status: 'connected',
      message: 'Tauri environment is ready',
      capabilities,
      recommendations: [],
    };
  } else if (capabilities.isTauri && !capabilities.hasInvoke) {
    return {
      status: 'connected',
      message: 'Tauri detected - initializing APIs',
      capabilities,
      recommendations: [],
    };
  } else {
    return {
      status: 'disconnected',
      message: 'Running in browser mode',
      capabilities,
      recommendations: [
        'Close this browser tab',
        'Run the desktop application using: npm run tauri:dev',
        'Make sure the Tauri development server is running',
        'Check that no firewall is blocking the application',
      ],
    };
  }
}
