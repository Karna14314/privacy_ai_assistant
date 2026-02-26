import CryptoJS from 'crypto-js';
export interface PrivacyConfig {
  enableEncryption: boolean;
  enableNetworkBlocking: boolean;
  enableDataSanitization: boolean;
  enableSecureStorage: boolean;
  encryptionKey?: string;
}
export const defaultPrivacyConfig: PrivacyConfig = {
  enableEncryption: true,
  enableNetworkBlocking: true,
  enableDataSanitization: true,
  enableSecureStorage: true,
};
export class EncryptionManager {
  private encryptionKey: string;
  constructor(key?: string) {
    this.encryptionKey = key || this.generateEncryptionKey();
  }
  private generateEncryptionKey(): string {
    const deviceInfo = navigator.userAgent + Date.now();
    return CryptoJS.SHA256(deviceInfo).toString();
  }
  encrypt(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (error) {
      console.error('Encryption failed:', error);
      return data;
    }
  }
  decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedData;
    }
  }
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }
}
export class SecureStorageManager {
  private encryption: EncryptionManager;
  private storagePrefix = 'privacy_ai_';
  constructor(encryptionManager: EncryptionManager) {
    this.encryption = encryptionManager;
  }
  setItem(key: string, value: any): void {
    try {
      const serializedValue = JSON.stringify(value);
      const encryptedValue = this.encryption.encrypt(serializedValue);
      localStorage.setItem(this.storagePrefix + key, encryptedValue);
    } catch (error) {
      console.error('Secure storage set failed:', error);
    }
  }
  getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const encryptedValue = localStorage.getItem(this.storagePrefix + key);
      if (!encryptedValue) return defaultValue || null;
      const decryptedValue = this.encryption.decrypt(encryptedValue);
      return JSON.parse(decryptedValue);
    } catch (error) {
      console.error('Secure storage get failed:', error);
      return defaultValue || null;
    }
  }
  removeItem(key: string): void {
    localStorage.removeItem(this.storagePrefix + key);
  }
  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.storagePrefix)) {
        localStorage.removeItem(key);
      }
    });
  }
  getAllKeys(): string[] {
    const keys = Object.keys(localStorage);
    return keys
      .filter(key => key.startsWith(this.storagePrefix))
      .map(key => key.replace(this.storagePrefix, ''));
  }
}
export class DataSanitizer {
  private sensitivePatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ];
  sanitizeText(text: string): string {
    let sanitized = text;
    this.sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }
  sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  }
  removePII(data: any): any {
    const piiFields = ['email', 'phone', 'ssn', 'address', 'name', 'ip'];
    if (typeof data === 'object' && data !== null) {
      const cleaned = { ...data };
      piiFields.forEach(field => {
        if (field in cleaned) {
          delete cleaned[field];
        }
      });
      return cleaned;
    }
    return data;
  }
}
export class NetworkIsolationManager {
  private blockedDomains = [
    'google.com',
    'googleapis.com',
    'openai.com',
    'anthropic.com',
    'microsoft.com',
    'azure.com',
    'aws.amazon.com',
  ];
  private allowedDomains = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ];
  blockNetworkRequests(): void {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!this.isAllowedUrl(url)) {
        console.warn('Blocked network request to:', url);
        throw new Error('Network request blocked by privacy manager');
      }
      return originalFetch(input, init);
    };
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      const urlString = url.toString();
      if (!this.isAllowedUrl(urlString)) {
        console.warn('Blocked XHR request to:', urlString);
        throw new Error('XHR request blocked by privacy manager');
      }
      return originalXHROpen.apply(this, [method, url, ...args]);
    }.bind(this);
  }
  private isAllowedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      if (this.allowedDomains.some(domain => hostname.includes(domain))) {
        return true;
      }
      if (this.blockedDomains.some(domain => hostname.includes(domain))) {
        return false;
      }
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  addAllowedDomain(domain: string): void {
    if (!this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
  }
  removeAllowedDomain(domain: string): void {
    const index = this.allowedDomains.indexOf(domain);
    if (index > -1) {
      this.allowedDomains.splice(index, 1);
    }
  }
}
export class PrivacyManager {
  private config: PrivacyConfig;
  private encryption: EncryptionManager;
  private secureStorage: SecureStorageManager;
  private dataSanitizer: DataSanitizer;
  private networkIsolation: NetworkIsolationManager;
  constructor(config: PrivacyConfig = defaultPrivacyConfig) {
    this.config = config;
    this.encryption = new EncryptionManager(config.encryptionKey);
    this.secureStorage = new SecureStorageManager(this.encryption);
    this.dataSanitizer = new DataSanitizer();
    this.networkIsolation = new NetworkIsolationManager();
    this.initialize();
  }
  private initialize(): void {
    if (this.config.enableNetworkBlocking) {
      this.networkIsolation.blockNetworkRequests();
    }
    this.addPrivacyIndicator();
  }
  private addPrivacyIndicator(): void {
    const indicator = document.createElement('div');
    indicator.id = 'privacy-indicator';
    indicator.innerHTML = ' Privacy Mode Active';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10b981;
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 10000;
      font-family: monospace;
    `;
    document.body.appendChild(indicator);
  }
  get storage() { return this.secureStorage; }
  get sanitizer() { return this.dataSanitizer; }
  get network() { return this.networkIsolation; }
  get crypto() { return this.encryption; }
  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  getPrivacyStatus(): {
    encryption: boolean;
    networkBlocking: boolean;
    secureStorage: boolean;
    sanitization: boolean;
  } {
    return {
      encryption: this.config.enableEncryption,
      networkBlocking: this.config.enableNetworkBlocking,
      secureStorage: this.config.enableSecureStorage,
      sanitization: this.config.enableDataSanitization,
    };
  }
}
export const privacyManager = new PrivacyManager();
