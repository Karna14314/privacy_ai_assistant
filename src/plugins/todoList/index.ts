import { Plugin, PluginResult, PluginContext } from '../../types';
const manifest = {
  name: "todoList",
  description: "Manage your todo list with add, list, delete, and complete functionality using local JSON storage",
  version: "1.0.0",
  author: "Privacy AI Assistant",
  keywords: ["todo", "task", "list", "manage", "organize"],
  triggerWords: ["todo", "task", "add task", "list tasks", "delete task", "complete task"],
  category: "productivity" as const,
  permissions: ["file:read", "file:write"]
};
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}
interface TodoStorage {
  todos: TodoItem[];
  lastUpdated: Date;
}
class TodoListPlugin implements Plugin {
  manifest = manifest;
  private storageKey = 'privacy-ai-todos';
  async run(input: string, context?: PluginContext): Promise<PluginResult> {
    try {
      const command = this.parseCommand(input);
      switch (command.action) {
        case 'add':
          return await this.addTodo(command.text);
        case 'list':
          return await this.listTodos();
        case 'delete':
          return await this.deleteTodo(command.id || command.text);
        case 'complete':
          return await this.completeTodo(command.id || command.text);
        case 'clear':
          return await this.clearTodos();
        default:
          return {
            success: false,
            error: 'Unknown todo command. Available commands: add, list, delete, complete, clear'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Todo plugin error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private parseCommand(input: string): { action: string; text?: string; id?: string } {
    const normalizedInput = input.toLowerCase().trim();
    if (normalizedInput.includes('add') || normalizedInput.includes('create')) {
      const text = input.replace(/^(add|create)\s+(task|todo)?\s*/i, '').trim();
      return { action: 'add', text };
    }
    if (normalizedInput.includes('list') || normalizedInput.includes('show') || normalizedInput === '') {
      return { action: 'list' };
    }
    if (normalizedInput.includes('delete') || normalizedInput.includes('remove')) {
      const text = input.replace(/^(delete|remove)\s+(task|todo)?\s*/i, '').trim();
      return { action: 'delete', text };
    }
    if (normalizedInput.includes('complete') || normalizedInput.includes('done') || normalizedInput.includes('finish')) {
      const text = input.replace(/^(complete|done|finish)\s+(task|todo)?\s*/i, '').trim();
      return { action: 'complete', text };
    }
    if (normalizedInput.includes('clear') || normalizedInput.includes('reset')) {
      return { action: 'clear' };
    }
    return { action: 'add', text: input };
  }
  private async addTodo(text: string): Promise<PluginResult> {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Please provide a task description'
      };
    }
    const storage = this.loadTodos();
    const newTodo: TodoItem = {
      id: this.generateId(),
      text: text.trim(),
      completed: false,
      createdAt: new Date()
    };
    storage.todos.push(newTodo);
    storage.lastUpdated = new Date();
    this.saveTodos(storage);
    return {
      success: true,
      message: `Added task: "${newTodo.text}"`,
      data: { todo: newTodo, totalTasks: storage.todos.length }
    };
  }
  private async listTodos(): Promise<PluginResult> {
    const storage = this.loadTodos();
    if (storage.todos.length === 0) {
      return {
        success: true,
        message: 'No tasks found. Add a task to get started!',
        data: { todos: [], count: 0 }
      };
    }
    const activeTodos = storage.todos.filter(t => !t.completed);
    const completedTodos = storage.todos.filter(t => t.completed);
    let message = ` **Todo List** (${storage.todos.length} total)\n\n`;
    if (activeTodos.length > 0) {
      message += `**Active Tasks (${activeTodos.length}):**\n`;
      activeTodos.forEach((todo, index) => {
        message += `${index + 1}. ⭕ ${todo.text}\n`;
      });
      message += '\n';
    }
    if (completedTodos.length > 0) {
      message += `**Completed Tasks (${completedTodos.length}):**\n`;
      completedTodos.forEach((todo, index) => {
        message += `${index + 1}. ✅ ${todo.text}\n`;
      });
    }
    return {
      success: true,
      message: message.trim(),
      data: { 
        todos: storage.todos, 
        active: activeTodos.length, 
        completed: completedTodos.length 
      }
    };
  }
  private async deleteTodo(identifier: string): Promise<PluginResult> {
    if (!identifier || identifier.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify which task to delete'
      };
    }
    const storage = this.loadTodos();
    const todoIndex = this.findTodoIndex(storage.todos, identifier);
    if (todoIndex === -1) {
      return {
        success: false,
        error: `Task not found: "${identifier}"`
      };
    }
    const deletedTodo = storage.todos[todoIndex];
    storage.todos.splice(todoIndex, 1);
    storage.lastUpdated = new Date();
    this.saveTodos(storage);
    return {
      success: true,
      message: `Deleted task: "${deletedTodo.text}"`,
      data: { deletedTodo, remainingTasks: storage.todos.length }
    };
  }
  private async completeTodo(identifier: string): Promise<PluginResult> {
    if (!identifier || identifier.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify which task to complete'
      };
    }
    const storage = this.loadTodos();
    const todoIndex = this.findTodoIndex(storage.todos, identifier);
    if (todoIndex === -1) {
      return {
        success: false,
        error: `Task not found: "${identifier}"`
      };
    }
    const todo = storage.todos[todoIndex];
    if (todo.completed) {
      return {
        success: false,
        error: `Task "${todo.text}" is already completed`
      };
    }
    todo.completed = true;
    todo.completedAt = new Date();
    storage.lastUpdated = new Date();
    this.saveTodos(storage);
    return {
      success: true,
      message: `Completed task: "${todo.text}" ✅`,
      data: { completedTodo: todo }
    };
  }
  private async clearTodos(): Promise<PluginResult> {
    const storage = this.loadTodos();
    const count = storage.todos.length;
    storage.todos = [];
    storage.lastUpdated = new Date();
    this.saveTodos(storage);
    return {
      success: true,
      message: `Cleared ${count} tasks from your todo list`,
      data: { clearedCount: count }
    };
  }
  private loadTodos(): TodoStorage {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          todos: parsed.todos.map((todo: any) => ({
            ...todo,
            createdAt: new Date(todo.createdAt),
            completedAt: todo.completedAt ? new Date(todo.completedAt) : undefined
          })),
          lastUpdated: new Date(parsed.lastUpdated)
        };
      }
    } catch (error) {
      console.error('Error loading todos:', error);
    }
    return { todos: [], lastUpdated: new Date() };
  }
  private saveTodos(storage: TodoStorage): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(storage));
    } catch (error) {
      console.error('Error saving todos:', error);
      throw new Error('Failed to save todos to storage');
    }
  }
  private findTodoIndex(todos: TodoItem[], identifier: string): number {
    const normalizedId = identifier.toLowerCase().trim();
    let index = todos.findIndex(todo => 
      todo.text.toLowerCase() === normalizedId
    );
    if (index !== -1) return index;
    index = todos.findIndex(todo => 
      todo.text.toLowerCase().includes(normalizedId)
    );
    if (index !== -1) return index;
    return todos.findIndex(todo => todo.id === identifier);
  }
  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
export const todoListPlugin = new TodoListPlugin();
