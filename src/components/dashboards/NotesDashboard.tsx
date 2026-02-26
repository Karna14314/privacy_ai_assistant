import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Trash2, Edit2, Search, Tag, Calendar, BookOpen, Save, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';
interface NotesDashboardProps {
  onClose: () => void;
  onExecute: (data: any) => Promise<{ success: boolean; message: string }>;
}
interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  isFavorite: boolean;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  characterCount: number;
}
const NotesDashboard: React.FC<NotesDashboardProps> = ({ onClose, onExecute }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'categories' | 'search' | 'settings'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showPrivate, setShowPrivate] = useState(false);
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'title' | 'wordCount'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [noteCategory, setNoteCategory] = useState('');
  const [noteIsFavorite, setNoteIsFavorite] = useState(false);
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);
  useEffect(() => {
    loadNotesData();
  }, []);
  const loadNotesData = () => {
    try {
      const savedNotes = localStorage.getItem('notes_data');
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes);
        setNotes(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load notes data:', error);
    }
  };
  const saveNotesData = (newNotes: Note[]) => {
    try {
      localStorage.setItem('notes_data', JSON.stringify(newNotes));
    } catch (error) {
      console.error('Failed to save notes data:', error);
    }
  };
  const calculateWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };
  const calculateCharacterCount = (text: string) => {
    return text.length;
  };
  const createNewNote = () => {
    setSelectedNote(null);
    setIsEditing(true);
    setNoteTitle('');
    setNoteContent('');
    setNoteTags('');
    setNoteCategory('');
    setNoteIsFavorite(false);
    setNoteIsPrivate(false);
  };
  const editNote = (note: Note) => {
    setSelectedNote(note);
    setIsEditing(true);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteTags(note.tags.join(', '));
    setNoteCategory(note.category);
    setNoteIsFavorite(note.isFavorite);
    setNoteIsPrivate(note.isPrivate);
  };
  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    setIsLoading(true);
    setStatus('loading');
    setStatusMessage('Saving note...');
    try {
      const tags = noteTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      const wordCount = calculateWordCount(noteContent);
      const characterCount = calculateCharacterCount(noteContent);
      if (selectedNote) {
        const updatedNote: Note = {
          ...selectedNote,
          title: noteTitle.trim(),
          content: noteContent,
          tags,
          category: noteCategory || 'General',
          isFavorite: noteIsFavorite,
          isPrivate: noteIsPrivate,
          updatedAt: new Date(),
          wordCount,
          characterCount
        };
        const updatedNotes = notes.map(note =>
          note.id === selectedNote.id ? updatedNote : note
        );
        setNotes(updatedNotes);
        saveNotesData(updatedNotes);
        const result = await onExecute({
          toolData: { action: 'update_note', note: updatedNote },
          context: { notes: updatedNotes }
        });
        if (result.success) {
          setStatus('success');
          setStatusMessage('Note updated successfully');
          setSelectedNote(updatedNote);
          setIsEditing(false);
        } else {
          setStatus('error');
          setStatusMessage(result.message);
        }
      } else {
        const newNote: Note = {
          id: Date.now().toString(),
          title: noteTitle.trim(),
          content: noteContent,
          tags,
          category: noteCategory || 'General',
          isFavorite: noteIsFavorite,
          isPrivate: noteIsPrivate,
          createdAt: new Date(),
          updatedAt: new Date(),
          wordCount,
          characterCount
        };
        const updatedNotes = [...notes, newNote];
        setNotes(updatedNotes);
        saveNotesData(updatedNotes);
        const result = await onExecute({
          toolData: { action: 'create_note', note: newNote },
          context: { notes: updatedNotes }
        });
        if (result.success) {
          setStatus('success');
          setStatusMessage('Note created successfully');
          setSelectedNote(newNote);
          setIsEditing(false);
        } else {
          setStatus('error');
          setStatusMessage(result.message);
        }
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Failed to save note');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };
  const deleteNote = async (id: string) => {
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
    saveNotesData(updatedNotes);
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setIsEditing(false);
    }
    await onExecute({
      toolData: { action: 'delete_note', id },
      context: { notes: updatedNotes }
    });
  };
  const toggleFavorite = async (note: Note) => {
    const updatedNote = { ...note, isFavorite: !note.isFavorite, updatedAt: new Date() };
    const updatedNotes = notes.map(n => n.id === note.id ? updatedNote : n);
    setNotes(updatedNotes);
    saveNotesData(updatedNotes);
    if (selectedNote?.id === note.id) {
      setSelectedNote(updatedNote);
    }
    await onExecute({
      toolData: { action: 'toggle_favorite', note: updatedNote },
      context: { notes: updatedNotes }
    });
  };
  const filteredAndSortedNotes = notes
    .filter(note => {
      if (!showPrivate && note.isPrivate) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return note.title.toLowerCase().includes(query) ||
               note.content.toLowerCase().includes(query) ||
               note.tags.some(tag => tag.toLowerCase().includes(query));
      }
      return true;
    })
    .filter(note => {
      if (filterCategory === 'all') return true;
      return note.category === filterCategory;
    })
    .filter(note => {
      if (filterTags.length === 0) return true;
      return filterTags.some(tag => note.tags.includes(tag));
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updated':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'wordCount':
          comparison = a.wordCount - b.wordCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  const categories = Array.from(new Set(notes.map(note => note.category)));
  const allTags = Array.from(new Set(notes.flatMap(note => note.tags)));
  const totalNotes = notes.length;
  const totalWords = notes.reduce((sum, note) => sum + note.wordCount, 0);
  const favoriteNotes = notes.filter(note => note.isFavorite).length;
  const tabs = [
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'settings', label: 'Settings', icon: BookOpen }
  ];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FileText size={24} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Notes Dashboard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create, organize, and manage your notes efficiently
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
                  ? "border-purple-500 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {}
        <div className="flex-1 flex overflow-hidden">
          {}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Search notes..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showPrivate"
                    checked={showPrivate}
                    onChange={(e) => setShowPrivate(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="showPrivate" className="text-xs text-gray-700 dark:text-gray-300">
                    Show private notes
                  </label>
                </div>
              </div>
            </div>
            {}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Notes</h3>
                <button
                  onClick={createNewNote}
                  className="p-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 rounded"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {filteredAndSortedNotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notes found</p>
                  </div>
                ) : (
                  filteredAndSortedNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => {
                        setSelectedNote(note);
                        setIsEditing(false);
                      }}
                      className={cn(
                        "p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-colors",
                        selectedNote?.id === note.id
                          ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {note.title}
                            </h4>
                            {note.isFavorite && (
                              <span className="text-yellow-500">⭐</span>
                            )}
                            {note.isPrivate && (
                              <EyeOff size={12} className="text-gray-400" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {note.content.substring(0, 100)}...
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {note.category}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {note.wordCount} words
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {note.updatedAt.toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(note);
                            }}
                            className="p-1 text-gray-400 hover:text-yellow-500 rounded"
                          >
                            {note.isFavorite ? '⭐' : '☆'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              editNote(note);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(note.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          {}
          <div className="flex-1 flex flex-col">
            {isEditing ? (
              <div className="flex-1 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {selectedNote ? 'Edit Note' : 'New Note'}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveNote}
                      disabled={isLoading || !noteTitle.trim()}
                      className="px-4 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors flex items-center space-x-2"
                    >
                      <Save size={14} />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter note title..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={noteCategory}
                        onChange={(e) => setNoteCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="General"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={noteTags}
                        onChange={(e) => setNoteTags(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={noteIsFavorite}
                        onChange={(e) => setNoteIsFavorite(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Favorite</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={noteIsPrivate}
                        onChange={(e) => setNoteIsPrivate(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Private</span>
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Content
                    </label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full h-full min-h-[300px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      placeholder="Start writing your note..."
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{calculateWordCount(noteContent)} words</span>
                    <span>{calculateCharacterCount(noteContent)} characters</span>
                  </div>
                </div>
              </div>
            ) : selectedNote ? (
              <div className="flex-1 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {selectedNote.title}
                    </h3>
                    {selectedNote.isFavorite && <span className="text-yellow-500">⭐</span>}
                    {selectedNote.isPrivate && <EyeOff size={16} className="text-gray-400" />}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => editNote(selectedNote)}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Category: {selectedNote.category}</span>
                    <span>{selectedNote.wordCount} words</span>
                    <span>{selectedNote.characterCount} characters</span>
                    <span>Updated: {selectedNote.updatedAt.toLocaleString()}</span>
                  </div>
                  {selectedNote.tags.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Tags:</span>
                      {selectedNote.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-y-auto">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {selectedNote.content.split('\n').map((line, index) => (
                        <p key={index} className="mb-2">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No note selected</p>
                  <p className="text-sm">Select a note from the sidebar or create a new one</p>
                  <button
                    onClick={createNewNote}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 mx-auto"
                  >
                    <Plus size={16} />
                    <span>Create New Note</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default NotesDashboard;
