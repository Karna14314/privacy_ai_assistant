export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  stack?: string;
}
class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private maxStoredLogs = 100;
  private constructor() {
    if (typeof window !== 'undefined') {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.logLevel = isDev ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }
  private formatMessage(level: LogLevel, category: string, message: string): string {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${levelNames[level]}] [${category}] ${message}`;
  }
  private storeLog(entry: LogEntry): void {
    try {
      const stored = JSON.parse(localStorage.getItem('app_logs') || '[]');
      stored.push(entry);
      if (stored.length > this.maxStoredLogs) {
        stored.splice(0, stored.length - this.maxStoredLogs);
      }
      localStorage.setItem('app_logs', JSON.stringify(stored));
    } catch (e) {
      console.warn('Failed to store log entry:', e);
    }
  }
  private log(level: LogLevel, category: string, message: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      stack: error?.stack,
    };
    const formattedMessage = this.formatMessage(level, category, message);
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data, error);
        break;
    }
    this.storeLog(entry);
  }
  public debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }
  public info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }
  public warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }
  public error(category: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data, error);
  }
  public getLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('app_logs') || '[]');
    } catch (e) {
      console.warn('Failed to retrieve logs:', e);
      return [];
    }
  }
  public clearLogs(): void {
    try {
      localStorage.removeItem('app_logs');
      console.info('Logs cleared');
    } catch (e) {
      console.warn('Failed to clear logs:', e);
    }
  }
  public exportLogs(): string {
    const logs = this.getLogs();
    return logs.map(log => {
      const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      let line = `[${log.timestamp}] [${levelNames[log.level]}] [${log.category}] ${log.message}`;
      if (log.data) {
        line += `\nData: ${JSON.stringify(log.data, null, 2)}`;
      }
      if (log.stack) {
        line += `\nStack: ${log.stack}`;
      }
      return line;
    }).join('\n\n');
  }
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Logger', `Log level set to ${LogLevel[level]}`);
  }
}
export const logger = Logger.getInstance();
export const appLogger = {
  debug: (message: string, data?: any) => logger.debug('App', message, data),
  info: (message: string, data?: any) => logger.info('App', message, data),
  warn: (message: string, data?: any) => logger.warn('App', message, data),
  error: (message: string, error?: Error, data?: any) => logger.error('App', message, error, data),
};
export const apiLogger = {
  debug: (message: string, data?: any) => logger.debug('API', message, data),
  info: (message: string, data?: any) => logger.info('API', message, data),
  warn: (message: string, data?: any) => logger.warn('API', message, data),
  error: (message: string, error?: Error, data?: any) => logger.error('API', message, error, data),
};
export const tauriLogger = {
  debug: (message: string, data?: any) => logger.debug('Tauri', message, data),
  info: (message: string, data?: any) => logger.info('Tauri', message, data),
  warn: (message: string, data?: any) => logger.warn('Tauri', message, data),
  error: (message: string, error?: Error, data?: any) => logger.error('Tauri', message, error, data),
};
export const voiceLogger = {
  debug: (message: string, data?: any) => logger.debug('Voice', message, data),
  info: (message: string, data?: any) => logger.info('Voice', message, data),
  warn: (message: string, data?: any) => logger.warn('Voice', message, data),
  error: (message: string, error?: Error, data?: any) => logger.error('Voice', message, error, data),
};
