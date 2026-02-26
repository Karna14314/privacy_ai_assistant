import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Plus, Trash2, Edit2, Calendar, Tag, Filter, SortAsc, SortDesc } from 'lucide-react';
import { cn } from '../../utils/cn';
interface TodoDashboardProps {
  onClose: () => void;
  onExecute: (data: any) => Promise<{ success: boolean; message: string }>;
}
interface TodoItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const TodoDashboard: React.FC<TodoDashboardProps> = ({ onClose, onExecute }) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'categories' | 'analytics' | 'settings'>('tasks');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTodoCategory, setNewTodoCategory] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'due' | 'priority' | 'title'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  useEffect(() => {
    loadTodoData();
  }, []);
  const loadTodoData = () => {
    try {
      const savedTodos = localStorage.getItem('todo_items');
      if (savedTodos) {
        const parsed = JSON.parse(savedTodos);
        setTodos(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined
        })));
      }
    } catch (error) {
      console.error('Failed to load todo data:', error);
    }
  };
  const saveTodoData = (newTodos: TodoItem[]) => {
    try {
      localStorage.setItem('todo_items', JSON.stringify(newTodos));
    } catch (error) {
      console.error('Failed to save todo data:', error);
    }
  };
  const addTodo = async () => {
    if (!newTodoTitle.trim()) return;
    setIsLoading(true);
    setStatus('loading');
    setStatusMessage('Adding task...');
    try {
      const newTodo: TodoItem = {
        id: Date.now().toString(),
        title: newTodoTitle.trim(),
        description: newTodoDescription.trim(),
        completed: false,
        priority: newTodoPriority,
        category: newTodoCategory || 'General',
        dueDate: newTodoDueDate ? new Date(newTodoDueDate) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const updatedTodos = [...todos, newTodo];
      setTodos(updatedTodos);
      saveTodoData(updatedTodos);
      const result = await onExecute({
        toolData: { action: 'add_todo', todo: newTodo },
        context: { todos: updatedTodos }
      });
      if (result.success) {
        setStatus('success');
        setStatusMessage('Task added successfully');
        setNewTodoTitle('');
        setNewTodoDescription('');
        setNewTodoPriority('medium');
        setNewTodoCategory('');
        setNewTodoDueDate('');
      } else {
        setStatus('error');
        setStatusMessage(result.message);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Failed to add task');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };
  const toggleTodo = async (id: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed, updatedAt: new Date() } : todo
    );
    setTodos(updatedTodos);
    saveTodoData(updatedTodos);
    const todo = updatedTodos.find(t => t.id === id);
    if (todo) {
      await onExecute({
        toolData: { action: 'toggle_todo', todo },
        context: { todos: updatedTodos }
      });
    }
  };
  const deleteTodo = async (id: string) => {
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    saveTodoData(updatedTodos);
    await onExecute({
      toolData: { action: 'delete_todo', id },
      context: { todos: updatedTodos }
    });
  };
  const updateTodo = async (updatedTodo: TodoItem) => {
    const updatedTodos = todos.map(todo =>
      todo.id === updatedTodo.id ? { ...updatedTodo, updatedAt: new Date() } : todo
    );
    setTodos(updatedTodos);
    saveTodoData(updatedTodos);
    setEditingTodo(null);
    await onExecute({
      toolData: { action: 'update_todo', todo: updatedTodo },
      context: { todos: updatedTodos }
    });
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '';
      case 'medium': return '';
      case 'low': return '';
      default: return '⚪';
    }
  };
  const filteredAndSortedTodos = todos
    .filter(todo => {
      if (filterStatus === 'active') return !todo.completed;
      if (filterStatus === 'completed') return todo.completed;
      return true;
    })
    .filter(todo => {
      if (filterPriority === 'all') return true;
      return todo.priority === filterPriority;
    })
    .filter(todo => {
      if (filterCategory === 'all') return true;
      return todo.category === filterCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'due':
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = a.dueDate.getTime() - b.dueDate.getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  const categories = Array.from(new Set(todos.map(todo => todo.category)));
  const completedCount = todos.filter(todo => todo.completed).length;
  const totalCount = todos.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'analytics', label: 'Analytics', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Filter }
  ];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckSquare size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Todo List Dashboard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your tasks and track your productivity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        {}
        {status !== 'idle' && (
          <div className={cn(
            "px-6 py-3 flex items-center space-x-2 transition-all duration-300",
            status === 'success' && "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
            status === 'error' && "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
            status === 'loading' && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
          )}>
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            )}
            <span className="text-sm font-medium">{statusMessage}</span>
          </div>
        )}
        {}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-green-500 text-green-600 dark:text-green-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add New Task</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={newTodoTitle}
                      onChange={(e) => setNewTodoTitle(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter task title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newTodoCategory}
                      onChange={(e) => setNewTodoCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Work, Personal, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={newTodoPriority}
                      onChange={(e) => setNewTodoPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTodoDescription}
                      onChange={(e) => setNewTodoDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Optional description..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={addTodo}
                      disabled={isLoading || !newTodoTitle.trim()}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Plus size={16} />
                      <span>Add Task</span>
                    </button>
                  </div>
                </div>
              </div>
              {}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority:</span>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as any)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category:</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">All</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="created">Created</option>
                    <option value="due">Due Date</option>
                    <option value="priority">Priority</option>
                    <option value="title">Title</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  >
                    {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                  </button>
                </div>
              </div>
              {}
              <div className="space-y-2">
                {filteredAndSortedTodos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No tasks found</p>
                  </div>
                ) : (
                  filteredAndSortedTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={cn(
                        "flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors",
                        todo.completed && "bg-gray-50 dark:bg-gray-800 opacity-75"
                      )}
                    >
                      <button
                        onClick={() => toggleTodo(todo.id)}
                        className="mt-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                      >
                        {todo.completed ? <CheckSquare size={20} className="text-green-600" /> : <Square size={20} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className={cn(
                              "text-sm font-medium",
                              todo.completed 
                                ? "text-gray-500 dark:text-gray-400 line-through" 
                                : "text-gray-900 dark:text-gray-100"
                            )}>
                              {todo.title}
                            </h3>
                            {todo.description && (
                              <p className={cn(
                                "text-xs mt-1",
                                todo.completed 
                                  ? "text-gray-400 dark:text-gray-500" 
                                  : "text-gray-600 dark:text-gray-400"
                              )}>
                                {todo.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 mt-2">
                              <span className={cn(
                                "px-2 py-1 text-xs rounded-full",
                                getPriorityColor(todo.priority)
                              )}>
                                {getPriorityIcon(todo.priority)} {todo.priority}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {todo.category}
                              </span>
                              {todo.dueDate && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Due: {todo.dueDate.toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            <button
                              onClick={() => setEditingTodo(todo)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteTodo(todo.id)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Task Categories</h3>
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No categories yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => {
                    const categoryTodos = todos.filter(todo => todo.category === category);
                    const completedCount = categoryTodos.filter(todo => todo.completed).length;
                    const totalCount = categoryTodos.length;
                    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    return (
                      <div
                        key={category}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{category}</h4>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{totalCount} tasks</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span>Progress</span>
                            <span>{completionRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {completedCount} of {totalCount} completed
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Task Analytics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Tasks</h4>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCount}</p>
                </div>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Completed</h4>
                  <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                </div>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Completion Rate</h4>
                  <p className="text-2xl font-bold text-blue-600">{completionRate}%</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Tasks by Priority</h4>
                  <div className="space-y-3">
                    {(['high', 'medium', 'low'] as const).map((priority) => {
                      const count = todos.filter(todo => todo.priority === priority).length;
                      const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                      return (
                        <div key={priority} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span>{getPriorityIcon(priority)}</span>
                            <span className="text-sm capitalize">{priority}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{count}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Recent Activity</h4>
                  <div className="space-y-2">
                    {todos
                      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                      .slice(0, 5)
                      .map((todo) => (
                        <div key={todo.id} className="flex items-center justify-between text-sm">
                          <span className={cn(
                            todo.completed ? "line-through text-gray-500" : "text-gray-900 dark:text-gray-100"
                          )}>
                            {todo.title}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {todo.updatedAt.toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Todo Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Priority
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Category
                  </label>
                  <input
                    type="text"
                    defaultValue="General"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Default category for new tasks"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoComplete"
                    defaultChecked
                    className="mr-3"
                  />
                  <label htmlFor="autoComplete" className="text-sm text-gray-700 dark:text-gray-300">
                    Auto-complete tasks when due date passes
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showCompleted"
                    defaultChecked
                    className="mr-3"
                  />
                  <label htmlFor="showCompleted" className="text-sm text-gray-700 dark:text-gray-300">
                    Show completed tasks in list
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableNotifications"
                    className="mr-3"
                  />
                  <label htmlFor="enableNotifications" className="text-sm text-gray-700 dark:text-gray-300">
                    Enable due date notifications
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default TodoDashboard;
