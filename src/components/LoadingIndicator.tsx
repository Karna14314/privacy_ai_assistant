import React from 'react';
const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></div>
          </div>
          <span className="text-sm">AI is thinking...</span>
        </div>
      </div>
    </div>
  );
};
export default LoadingIndicator;
