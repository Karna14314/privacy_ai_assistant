import React, { useState, useEffect } from 'react';
import { X, User, Plus, Trash2, Edit2, Save, Eye, EyeOff, Shield, Lock, Unlock, Key, Mail, Phone, MapPin, Calendar, Building, Globe } from 'lucide-react';
import { cn } from '../../utils/cn';
interface PersonalInfoDashboardProps {
  onClose: () => void;
  onExecute: (data: any) => Promise<{ success: boolean; message: string }>;
}
interface PersonalInfo {
  id: string;
  category: 'personal' | 'contact' | 'professional' | 'security' | 'preferences';
  title: string;
  value: string;
  isSensitive: boolean;
  isEncrypted: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
const PersonalInfoDashboard: React.FC<PersonalInfoDashboardProps> = ({ onClose, onExecute }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'contact' | 'professional' | 'security' | 'preferences'>('overview');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo[]>([]);
  const [editingItem, setEditingItem] = useState<PersonalInfo | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [itemCategory, setItemCategory] = useState<'personal' | 'contact' | 'professional' | 'security' | 'preferences'>('personal');
  const [itemDescription, setItemDescription] = useState('');
  const [itemIsSensitive, setItemIsSensitive] = useState(false);
  const [itemIsEncrypted, setItemIsEncrypted] = useState(false);
  useEffect(() => {
    loadPersonalInfoData();
  }, []);
  const loadPersonalInfoData = () => {
    try {
      const savedData = localStorage.getItem('personal_info_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setPersonalInfo(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        })));
      } else {
        const defaultData: PersonalInfo[] = [
          {
            id: '1',
            category: 'personal',
            title: 'Full Name',
            value: '',
            isSensitive: true,
            isEncrypted: true,
            description: 'Your full legal name',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '2',
            category: 'contact',
            title: 'Email Address',
            value: '',
            isSensitive: true,
            isEncrypted: true,
            description: 'Primary email address',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '3',
            category: 'contact',
            title: 'Phone Number',
            value: '',
            isSensitive: true,
            isEncrypted: true,
            description: 'Primary phone number',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '4',
            category: 'personal',
            title: 'Date of Birth',
            value: '',
            isSensitive: true,
            isEncrypted: true,
            description: 'Your date of birth',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '5',
            category: 'professional',
            title: 'Job Title',
            value: '',
            isSensitive: false,
            isEncrypted: false,
            description: 'Current job title or position',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: '6',
            category: 'professional',
            title: 'Company',
            value: '',
            isSensitive: false,
            isEncrypted: false,
            description: 'Current employer or company',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        setPersonalInfo(defaultData);
        savePersonalInfoData(defaultData);
      }
    } catch (error) {
      console.error('Failed to load personal info data:', error);
    }
  };
  const savePersonalInfoData = (newData: PersonalInfo[]) => {
    try {
      localStorage.setItem('personal_info_data', JSON.stringify(newData));
    } catch (error) {
      console.error('Failed to save personal info data:', error);
    }
  };
  const createNewItem = () => {
    setEditingItem(null);
    setItemTitle('');
    setItemValue('');
    setItemCategory('personal');
    setItemDescription('');
    setItemIsSensitive(false);
    setItemIsEncrypted(false);
  };
  const editItem = (item: PersonalInfo) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemValue(item.value);
    setItemCategory(item.category);
    setItemDescription(item.description || '');
    setItemIsSensitive(item.isSensitive);
    setItemIsEncrypted(item.isEncrypted);
  };
  const saveItem = async () => {
    if (!itemTitle.trim() || !itemValue.trim()) return;
    setIsLoading(true);
    setStatus('loading');
    setStatusMessage('Saving information...');
    try {
      if (editingItem) {
        const updatedItem: PersonalInfo = {
          ...editingItem,
          title: itemTitle.trim(),
          value: itemValue.trim(),
          category: itemCategory,
          description: itemDescription.trim() || undefined,
          isSensitive: itemIsSensitive,
          isEncrypted: itemIsEncrypted,
          updatedAt: new Date()
        };
        const updatedData = personalInfo.map(item =>
          item.id === editingItem.id ? updatedItem : item
        );
        setPersonalInfo(updatedData);
        savePersonalInfoData(updatedData);
        const result = await onExecute({
          toolData: { action: 'update_personal_info', item: updatedItem },
          context: { personalInfo: updatedData }
        });
        if (result.success) {
          setStatus('success');
          setStatusMessage('Information updated successfully');
          setEditingItem(null);
        } else {
          setStatus('error');
          setStatusMessage(result.message);
        }
      } else {
        const newItem: PersonalInfo = {
          id: Date.now().toString(),
          title: itemTitle.trim(),
          value: itemValue.trim(),
          category: itemCategory,
          description: itemDescription.trim() || undefined,
          isSensitive: itemIsSensitive,
          isEncrypted: itemIsEncrypted,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const updatedData = [...personalInfo, newItem];
        setPersonalInfo(updatedData);
        savePersonalInfoData(updatedData);
        const result = await onExecute({
          toolData: { action: 'create_personal_info', item: newItem },
          context: { personalInfo: updatedData }
        });
        if (result.success) {
          setStatus('success');
          setStatusMessage('Information added successfully');
          setEditingItem(null);
        } else {
          setStatus('error');
          setStatusMessage(result.message);
        }
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('Failed to save information');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };
  const deleteItem = async (id: string) => {
    const updatedData = personalInfo.filter(item => item.id !== id);
    setPersonalInfo(updatedData);
    savePersonalInfoData(updatedData);
    if (editingItem?.id === id) {
      setEditingItem(null);
    }
    await onExecute({
      toolData: { action: 'delete_personal_info', id },
      context: { personalInfo: updatedData }
    });
  };
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'personal': return User;
      case 'contact': return Mail;
      case 'professional': return Building;
      case 'security': return Shield;
      case 'preferences': return Globe;
      default: return User;
    }
  };
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'personal': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'contact': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'professional': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
      case 'security': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'preferences': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };
  const filteredItems = personalInfo.filter(item => {
    if (activeTab === 'overview') return true;
    return item.category === activeTab;
  });
  const categories = ['personal', 'contact', 'professional', 'security', 'preferences'] as const;
  const sensitiveItems = personalInfo.filter(item => item.isSensitive);
  const encryptedItems = personalInfo.filter(item => item.isEncrypted);
  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'contact', label: 'Contact', icon: Mail },
    { id: 'professional', label: 'Professional', icon: Building },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Globe }
  ];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <User size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Personal Information Dashboard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your personal information securely
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
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
          <div className="flex-1 flex flex-col">
            {}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {activeTab === 'overview' ? 'All Information' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Information
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowSensitive(!showSensitive)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {showSensitive ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{showSensitive ? 'Hide' : 'Show'} Sensitive</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={createNewItem}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <Plus size={14} />
                  <span>Add Info</span>
                </button>
              </div>
            </div>
            {}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No information found</p>
                  <p className="text-sm mt-1">Add your personal information to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "px-2 py-1 text-xs rounded-full",
                            getCategoryColor(item.category)
                          )}>
                            {item.category}
                          </span>
                          {item.isSensitive && (
                            <span className="text-red-500">
                              <Shield size={12} />
                            </span>
                          )}
                          {item.isEncrypted && (
                            <span className="text-blue-500">
                              <Lock size={12} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => editItem(item)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {item.isSensitive && !showSensitive 
                          ? '••••••••••••••••' 
                          : item.value
                        }
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span>Updated: {item.updatedAt.toLocaleDateString()}</span>
                        <span>Created: {item.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {}
          {editingItem !== null || (editingItem === null && itemTitle) ? (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {editingItem ? 'Edit Information' : 'Add Information'}
                </h3>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemTitle('');
                    setItemValue('');
                    setItemCategory('personal');
                    setItemDescription('');
                    setItemIsSensitive(false);
                    setItemIsEncrypted(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Full Name, Email Address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value *
                  </label>
                  <input
                    type="text"
                    value={itemValue}
                    onChange={(e) => setItemValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter the information value"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="personal">Personal</option>
                    <option value="contact">Contact</option>
                    <option value="professional">Professional</option>
                    <option value="security">Security</option>
                    <option value="preferences">Preferences</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Optional description"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={itemIsSensitive}
                      onChange={(e) => setItemIsSensitive(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Sensitive Information</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={itemIsEncrypted}
                      onChange={(e) => setItemIsEncrypted(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Encrypt Data</span>
                  </label>
                </div>
                <button
                  onClick={saveItem}
                  disabled={isLoading || !itemTitle.trim() || !itemValue.trim()}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center space-x-2"
                >
                  <Save size={14} />
                  <span>{editingItem ? 'Update' : 'Save'}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {}
        {activeTab === 'overview' && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {personalInfo.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {sensitiveItems.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Sensitive</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {encryptedItems.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Encrypted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {categories.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Categories</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default PersonalInfoDashboard;
