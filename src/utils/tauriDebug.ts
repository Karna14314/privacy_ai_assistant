export function debugTauriEnvironment(): void {
  console.group(' Tauri Environment Debug');
  console.log('typeof window:', typeof window);
  console.log('window exists:', typeof window !== 'undefined');
  if (typeof window !== 'undefined') {
    console.log('window.location.href:', window.location.href);
    console.log('window.navigator.userAgent:', window.navigator.userAgent);
    console.log('window.__TAURI__ exists:', !!window.__TAURI__);
    if (window.__TAURI__) {
      console.log('window.__TAURI__:', window.__TAURI__);
      console.log('window.__TAURI__.invoke exists:', typeof window.__TAURI__.invoke === 'function');
      console.log('window.__TAURI__.tauri exists:', !!window.__TAURI__.tauri);
      if (window.__TAURI__.tauri) {
        console.log('window.__TAURI__.tauri.version:', window.__TAURI__.tauri.version);
      }
    } else {
      console.warn('❌ window.__TAURI__ is not available');
      console.log('Available window properties:', Object.keys(window).filter(key => key.includes('tauri') || key.includes('TAURI')));
    }
  }
  console.groupEnd();
}
export function waitForWindowProperty(propertyPath: string, maxWaitMs: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkProperty = () => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not available'));
        return;
      }
      const parts = propertyPath.split('.');
      let current: any = window;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) {
        resolve(current);
        return;
      }
      if (Date.now() - startTime >= maxWaitMs) {
        reject(new Error(`Property ${propertyPath} not available after ${maxWaitMs}ms`));
        return;
      }
      setTimeout(checkProperty, 50);
    };
    checkProperty();
  });
}
if (typeof window !== 'undefined') {
  setTimeout(() => {
    debugTauriEnvironment();
  }, 100);
}
