import { Plugin, PluginResult, PluginContext } from '../../types';
const manifest = {
  name: "noteTaker",
  description: "Save and retrieve timestamped notes with search functionality using local JSON storage",
  version: "1.0.0",
  author: "Privacy AI Assistant",
  keywords: ["note", "save", "write", "remember", "record"],
  triggerWords: ["note", "save note", "take note", "remember", "write down", "record"],
  category: "productivity" as const,
  permissions: ["file:read", "file:write"]
};
interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}
interface NotesStorage {
  notes: Note[];
  lastUpdated: Date;
}
class NoteTakerPlugin implements Plugin {
  manifest = manifest;
  private storageKey = 'privacy-ai-notes';
  async run(input: string, context?: PluginContext): Promise<PluginResult> {
    try {
      const command = this.parseCommand(input);
      switch (command.action) {
        case 'save':
          return await this.saveNote(command.content, command.title);
        case 'list':
          return await this.listNotes(command.query);
        case 'search':
          return await this.searchNotes(command.query);
        case 'delete':
          return await this.deleteNote(command.id || command.query);
        case 'get':
          return await this.getNote(command.id || command.query);
        case 'clear':
          return await this.clearNotes();
        default:
          return {
            success: false,
            error: 'Unknown note command. Available commands: save, list, search, get, delete, clear'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Note plugin error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  private parseCommand(input: string): { action: string; content?: string; title?: string; query?: string; id?: string } {
    const normalizedInput = input.toLowerCase().trim();
    if (normalizedInput.includes('save') || normalizedInput.includes('take') || normalizedInput.includes('write') || normalizedInput.includes('record')) {
      const content = input.replace(/^(save|take|write|record)\s+(note|down)?\s*/i, '').trim();
      const title = this.extractTitle(content);
      return { action: 'save', content, title };
    }
    if (normalizedInput.includes('search') || normalizedInput.includes('find')) {
      const query = input.replace(/^(search|find)\s+(note|notes)?\s*/i, '').trim();
      return { action: 'search', query };
    }
    if (normalizedInput.includes('get') || normalizedInput.includes('show')) {
      const query = input.replace(/^(get|show)\s+(note|notes)?\s*/i, '').trim();
      return { action: 'get', query };
    }
    if (normalizedInput.includes('delete') || normalizedInput.includes('remove')) {
      const query = input.replace(/^(delete|remove)\s+(note|notes)?\s*/i, '').trim();
      return { action: 'delete', query };
    }
    if (normalizedInput.includes('list') || normalizedInput.includes('show all') || normalizedInput === '') {
      return { action: 'list' };
    }
    if (normalizedInput.includes('clear') || normalizedInput.includes('reset')) {
      return { action: 'clear' };
    }
    return { action: 'save', content: input };
  }
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...';
    }
    return firstLine || `Note ${new Date().toLocaleDateString()}`;
  }
  private async saveNote(content: string, title?: string): Promise<PluginResult> {
    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: 'Please provide note content'
      };
    }
    const storage = this.loadNotes();
    const noteTitle = title || this.extractTitle(content);
    const tags = this.extractTags(content);
    const newNote: Note = {
      id: this.generateId(),
      title: noteTitle,
      content: content.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      tags
    };
    storage.notes.push(newNote);
    storage.lastUpdated = new Date();
    this.saveNotes(storage);
    return {
      success: true,
      message: `Note saved: "${noteTitle}"`,
      data: { note: newNote, totalNotes: storage.notes.length }
    };
  }
  private async listNotes(query?: string): Promise<PluginResult> {
    const storage = this.loadNotes();
    let notes = storage.notes;
    if (query && query.trim().length > 0) {
      notes = this.filterNotes(notes, query);
    }
    if (notes.length === 0) {
      const message = query 
        ? `No notes found matching "${query}"`
        : 'No notes found. Save a note to get started!';
      return {
        success: true,
        message,
        data: { notes: [], count: 0 }
      };
    }
    notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    let message = ` **Notes** (${notes.length} found)\n\n`;
    notes.slice(0, 10).forEach((note, index) => {
      const date = new Date(note.createdAt).toLocaleDateString();
      const preview = note.content.length > 100 
        ? note.content.substring(0, 97) + '...'
        : note.content;
      message += `**${index + 1}. ${note.title}** (${date})\n`;
      message += `${preview}\n`;
      if (note.tags.length > 0) {
        message += `Tags: ${note.tags.join(', ')}\n`;
      }
      message += '\n';
    });
    if (notes.length > 10) {
      message += `... and ${notes.length - 10} more notes`;
    }
    return {
      success: true,
      message: message.trim(),
      data: { notes, count: notes.length }
    };
  }
  private async searchNotes(query: string): Promise<PluginResult> {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Please provide a search query'
      };
    }
    return await this.listNotes(query);
  }
  private async getNote(identifier: string): Promise<PluginResult> {
    if (!identifier || identifier.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify which note to retrieve'
      };
    }
    const storage = this.loadNotes();
    const note = this.findNote(storage.notes, identifier);
    if (!note) {
      return {
        success: false,
        error: `Note not found: "${identifier}"`
      };
    }
    const date = new Date(note.createdAt).toLocaleString();
    let message = ` **${note.title}** (${date})\n\n`;
    message += note.content;
    if (note.tags.length > 0) {
      message += `\n\n**Tags:** ${note.tags.join(', ')}`;
    }
    return {
      success: true,
      message,
      data: { note }
    };
  }
  private async deleteNote(identifier: string): Promise<PluginResult> {
    if (!identifier || identifier.trim().length === 0) {
      return {
        success: false,
        error: 'Please specify which note to delete'
      };
    }
    const storage = this.loadNotes();
    const noteIndex = this.findNoteIndex(storage.notes, identifier);
    if (noteIndex === -1) {
      return {
        success: false,
        error: `Note not found: "${identifier}"`
      };
    }
    const deletedNote = storage.notes[noteIndex];
    storage.notes.splice(noteIndex, 1);
    storage.lastUpdated = new Date();
    this.saveNotes(storage);
    return {
      success: true,
      message: `Deleted note: "${deletedNote.title}"`,
      data: { deletedNote, remainingNotes: storage.notes.length }
    };
  }
  private async clearNotes(): Promise<PluginResult> {
    const storage = this.loadNotes();
    const count = storage.notes.length;
    storage.notes = [];
    storage.lastUpdated = new Date();
    this.saveNotes(storage);
    return {
      success: true,
      message: `Cleared ${count} notes`,
      data: { clearedCount: count }
    };
  }
  private loadNotes(): NotesStorage {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          notes: parsed.notes.map((note: any) => ({
            ...note,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt)
          })),
          lastUpdated: new Date(parsed.lastUpdated)
        };
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
    return { notes: [], lastUpdated: new Date() };
  }
  private saveNotes(storage: NotesStorage): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(storage));
    } catch (error) {
      console.error('Error saving notes:', error);
      throw new Error('Failed to save notes to storage');
    }
  }
  private filterNotes(notes: Note[], query: string): Note[] {
    const normalizedQuery = query.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(normalizedQuery) ||
      note.content.toLowerCase().includes(normalizedQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  }
  private findNote(notes: Note[], identifier: string): Note | undefined {
    const normalizedId = identifier.toLowerCase().trim();
    let note = notes.find(n => n.title.toLowerCase() === normalizedId);
    if (note) return note;
    note = notes.find(n => n.title.toLowerCase().includes(normalizedId));
    if (note) return note;
    note = notes.find(n => n.content.toLowerCase().includes(normalizedId));
    if (note) return note;
    return notes.find(n => n.id === identifier);
  }
  private findNoteIndex(notes: Note[], identifier: string): number {
    const note = this.findNote(notes, identifier);
    return note ? notes.findIndex(n => n.id === note.id) : -1;
  }
  private extractTags(content: string): string[] {
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex);
    if (!matches) return [];
    return matches.map(tag => tag.substring(1).toLowerCase());
  }
  private generateId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
export const noteTakerPlugin = new NoteTakerPlugin();
