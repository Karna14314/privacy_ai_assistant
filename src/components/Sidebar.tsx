import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import {
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  Edit2,
  Trash2,
  MoreHorizontal,
  Copy,
  Check,
  X,
  Download,
  Upload
} from 'lucide-react';
import { useAppStore, useMultiChatStore } from '../stores/chatStore';
import { ChatSessionSummary } from '../types';
interface ChatItemProps {
  session: ChatSessionSummary;
  isActive: boolean;
  onSelect: (chatId: string) => void;
  onRename: (chatId: string, newTitle: string) => void;
  onDelete: (chatId: string) => void;
  onDuplicate: (chatId: string) => void;
  onExport: (chatId: string) => void;
}
const ChatItem: React.FC<ChatItemProps> = ({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onDuplicate,
  onExport
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [showMenu, setShowMenu] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(session.id, editTitle.trim());
    }
    setIsEditing(false);
  };
  const handleCancelEdit = () => {
    setEditTitle(session.title);
    setIsEditing(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };
  const formatLastActivity = (date: Date | null | undefined) => {
    if (!date) {
      return 'No activity';
    }
    const activityDate = date instanceof Date ? date : new Date(date);
    if (isNaN(activityDate.getTime())) {
      return 'Invalid date';
    }
    const now = new Date();
    const diff = now.getTime() - activityDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return activityDate.toLocaleDateString();
    }
  };
  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      )}
      onClick={() => !isEditing && onSelect(session.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={editInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {session.title}
                </h3>
              </div>
              {}
              {session.lastMessage && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                  {session.lastMessage.length > 50
                    ? `${session.lastMessage.substring(0, 50)}...`
                    : session.lastMessage}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
                    {session.messageCount}
                  </span>
                  <span>{formatLastActivity(session.lastActivity)}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-opacity"
            >
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                >
                  <Edit2 size={14} />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(session.id);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Copy size={14} />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(session.id);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Download size={14} />
                  Export Chat
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-b-lg"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
const Sidebar: React.FC = () => {
  const [showSidebar, setShowSidebar] = useState(true);
  const { preferences, setTheme } = useAppStore();
  const {
    chatSummaries,
    chatSessions,
    activeChatId,
    createNewChat,
    switchToChat,
    renameChat,
    deleteChat,
    duplicateChat,
    loadChatSessions,
    isLoading
  } = useMultiChatStore();
  useEffect(() => {
    loadChatSessions();
  }, []);
  const toggleSidebar = () => setShowSidebar(!showSidebar);
  const handleThemeToggle = () => {
    const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };
  const handleNewChat = async () => {
    try {
      await createNewChat();
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };
  const handleSelectChat = async (chatId: string) => {
    try {
      await switchToChat(chatId);
    } catch (error) {
      console.error('Failed to switch to chat:', error);
    }
  };
  const handleRenameChat = async (chatId: string, newTitle: string) => {
    try {
      await renameChat(chatId, newTitle);
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };
  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      try {
        await deleteChat(chatId);
      } catch (error) {
        console.error('Failed to delete chat:', error);
      }
    }
  };
  const handleDuplicateChat = async (chatId: string) => {
    try {
      await duplicateChat(chatId);
    } catch (error) {
      console.error('Failed to duplicate chat:', error);
    }
  };
  const handleExportChat = async (chatId: string) => {
    try {
      const session = chatSessions[chatId];
      if (!session) {
        console.error('Chat session not found');
        return;
      }
      const exportData = {
        id: session.id,
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        metadata: session.metadata,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('Chat exported successfully');
    } catch (error) {
      console.error('Failed to export chat:', error);
    }
  };
  const handleImportChat = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        if (!importData.title || !importData.messages || !Array.isArray(importData.messages)) {
          throw new Error('Invalid chat file format');
        }
        const newChatId = await createNewChat(`${importData.title} (Imported)`);
        console.log('Chat imported successfully:', newChatId);
      } catch (error) {
        console.error('Failed to import chat:', error);
        alert('Failed to import chat. Please check the file format.');
      }
    };
    input.click();
  };
  return (
    <>
      <button
        type="button"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        {showSidebar ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
      <div
        className={cn(
          'fixed top-0 left-0 h-full w-80 transition-transform transform z-40',
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-full bg-white dark:bg-gray-900 shadow-lg flex flex-col border-r border-gray-200 dark:border-gray-700">
          {}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              New Chat
            </button>
            <button
              type="button"
              onClick={handleImportChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Upload size={16} />
              Import Chat
            </button>
          </div>
          {}
          <div className="flex-1 overflow-y-auto p-2">
            {chatSummaries.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No chats yet</p>
                <p className="text-xs mt-1">Create your first chat to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatSummaries.map((session) => (
                  <ChatItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeChatId}
                    onSelect={handleSelectChat}
                    onRename={handleRenameChat}
                    onDelete={handleDeleteChat}
                    onDuplicate={handleDuplicateChat}
                    onExport={handleExportChat}
                  />
                ))}
              </div>
            )}
          </div>
          {}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="flex items-center gap-3 p-4 w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span>{preferences.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</span>
              <span className="text-sm">Toggle Dark Mode</span>
            </button>
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Privacy AI Assistant</span>
                <span>v0.1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};
export default Sidebar;
