import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug, Copy } from 'lucide-react';
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };
  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(' Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    this.logErrorDetails(error, errorInfo);
  }
  private logErrorDetails = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    console.group(' Error Boundary Details');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Full Details:', errorDetails);
    console.groupEnd();
    try {
      const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      existingErrors.push(errorDetails);
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10);
      }
      localStorage.setItem('app_errors', JSON.stringify(existingErrors));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }
  };
  private handleReload = () => {
    window.location.reload();
  };
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };
  private copyErrorDetails = () => {
    if (!this.state.error || !this.state.errorInfo) return;
    const errorText = `
Error: ${this.state.error.message}
Stack Trace:
${this.state.error.stack}
Component Stack:
${this.state.errorInfo.componentStack}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();
    navigator.clipboard.writeText(errorText).then(() => {
      alert('Error details copied to clipboard!');
    }).catch(() => {
      console.warn('Failed to copy to clipboard');
    });
  };
  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <AlertTriangle className="w-16 h-16 text-red-500" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <Bug className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The application encountered an unexpected error. This has been logged for debugging.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  Error Details:
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reload App
              </button>
              <button
                onClick={this.copyErrorDetails}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Error</span>
              </button>
            </div>
            <div className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
              <p>
                If this problem persists, please check the browser console for more details.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
