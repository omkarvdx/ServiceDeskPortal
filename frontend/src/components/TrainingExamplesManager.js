import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Plus, Edit, Trash2, BarChart3, Filter, X, Save } from 'lucide-react';
import APIService from '../services/api';
import AccessDenied from './AccessDenied';

// Simple toast function replacement
const toast = {
  success: (message) => alert(`✅ ${message}`),
  error: (message) => alert(`❌ ${message}`)
};

// Form component for adding/editing training examples
const TrainingExampleForm = ({ 
  example, 
  onSave, 
  onCancel, 
  ctiCategories = [], 
  ctiCategoriesLoading = false, 
  ctiCategoriesError = null,
  onRetry = () => {}
}) => {
  const [formData, setFormData] = useState({
    ticket_content: example?.ticket_content || '',
    correct_cti: example?.correct_cti?.id || '',
    source: example?.source || 'manual',
    weight: example?.weight || 1.0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'weight' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              {example ? 'Edit Training Example' : 'Add New Training Example'}
            </h3>
            <button 
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Content *
              </label>
              <textarea
                name="ticket_content"
                value={formData.ticket_content}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 h-32"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CTI Category *
                </label>
                {ctiCategoriesLoading ? (
                  <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 text-gray-500">
                    Loading categories...
                  </div>
                ) : ctiCategoriesError ? (
                  <div className="text-red-600 text-sm mb-2">
                    {ctiCategoriesError}
                    <button 
                      onClick={onRetry}
                      className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    name="correct_cti"
                    value={formData.correct_cti}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required
                    disabled={ctiCategories.length === 0}
                  >
                    <option value="">
                      {ctiCategories.length === 0 
                        ? 'No categories available' 
                        : 'Select a category'}
                    </option>
                    {Object.entries(
                      ctiCategories.reduce((groups, cat) => {
                        const group = cat.category || 'Other';
                        if (!groups[group]) {
                          groups[group] = [];
                        }
                        groups[group].push(cat);
                        return groups;
                      }, {})
                    ).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.item} {cat.sub_item ? `- ${cat.sub_item}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="initial">Initial</option>
                  <option value="correction">Correction</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight
                </label>
                <input
                  type="number"
                  name="weight"
                  min="0.1"
                  step="0.1"
                  value={formData.weight}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {example ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const TrainingExamplesManager = ({ user }) => {
  const [examples, setExamples] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentExample, setCurrentExample] = useState(null);
  const [ctiCategories, setCtiCategories] = useState([]);
  const [ctiCategoriesLoading, setCtiCategoriesLoading] = useState(false);
  const [ctiCategoriesError, setCtiCategoriesError] = useState(null);
  const [filters, setFilters] = useState({
    source: '',
    search: '',
    cti_category: ''
  });
  const [searchInput, setSearchInput] = useState('');

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Load CTI categories only once on mount
  useEffect(() => {
    fetchCtiCategories();
  }, []);

  // Load examples and stats when filters change (but not CTI categories)
  useEffect(() => {
    const loadFilteredData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchTrainingExamples(),
          fetchTrainingStats()
        ]);
      } catch (error) {
        console.error('Error loading filtered data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadFilteredData();
  }, [filters]);

  const fetchTrainingExamples = useCallback(async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      const data = await APIService.request('/admin/training-examples/', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      setExamples(data.results || data || []);
      return true;
    } catch (error) {
      console.error('Error fetching training examples:', error);
      throw error;
    }
  }, [filters]);

  const fetchTrainingStats = useCallback(async () => {
    try {
      const data = await APIService.request('/admin/training-stats/');
      setStats(data || {});
      return true;
    } catch (error) {
      console.error('Error fetching training stats:', error);
      return false;
    }
  }, []);

  const fetchCtiCategories = useCallback(async () => {
    try {
      setCtiCategoriesLoading(true);
      setCtiCategoriesError(null);
      const data = await APIService.getAdminCTIRecords();
      const categories = Array.isArray(data) ? data : data.results || [];
      setCtiCategories(categories);
      
      if (categories.length === 0) {
        setCtiCategoriesError('No CTI categories found. Please add categories first.');
      }
    } catch (error) {
      console.error('Error fetching CTI categories:', error);
      const errorMessage = error.message || 'Failed to load CTI categories';
      setCtiCategoriesError(errorMessage);
    } finally {
      setCtiCategoriesLoading(false);
    }
  }, []);

  const handleAddExample = useCallback(() => {
    setCurrentExample(null);
    setShowForm(true);
  }, []);

  const handleEditExample = useCallback((example) => {
    setCurrentExample(example);
    setShowForm(true);
  }, []);

  const handleSaveExample = useCallback(async (formData) => {
    try {
      setLoading(true);
      if (currentExample) {
        await APIService.updateTrainingExample(currentExample.id, formData);
        toast.success('Training example updated successfully');
      } else {
        await APIService.createTrainingExample(formData);
        toast.success('Training example created successfully');
      }
      
      await Promise.all([fetchTrainingExamples(), fetchTrainingStats()]);
      setShowForm(false);
    } catch (error) {
      console.error('Error saving training example:', error);
      toast.error(error.message || 'Failed to save training example');
    } finally {
      setLoading(false);
    }
  }, [currentExample, fetchTrainingExamples, fetchTrainingStats]);

  const handleDelete = useCallback(async (exampleId) => {
    if (!window.confirm('Are you sure you want to delete this training example?')) return;

    try {
      setLoading(true);
      await APIService.deleteTrainingExample(exampleId);
      await Promise.all([fetchTrainingExamples(), fetchTrainingStats()]);
      toast.success('Training example deleted successfully');
    } catch (error) {
      console.error('Error deleting training example:', error);
      
      if (error.message && error.message.includes('404')) {
        await Promise.all([fetchTrainingExamples(), fetchTrainingStats()]);
        toast.error('This training example was already deleted');
      } else {
        const errorMessage = error.message || 'Failed to delete training example';
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchTrainingExamples, fetchTrainingStats]);

  const getSourceBadge = useMemo(() => (source) => {
    const colors = {
      'initial': 'bg-blue-100 text-blue-800',
      'correction': 'bg-green-100 text-green-800',
      'manual': 'bg-purple-100 text-purple-800'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[source] || colors.manual}`}>
        {source.replace('_', ' ').toUpperCase()}
      </span>
    );
  }, []);

  const getWeightIndicator = useMemo(() => (weight) => {
    const color = weight >= 1.5 ? 'text-green-600' : weight >= 1.0 ? 'text-blue-600' : 'text-gray-600';
    return (
      <span className={`font-semibold ${color}`}>
        {weight}x
      </span>
    );
  }, []);

  if (user?.role !== 'admin') {
    return <AccessDenied />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error} <button 
                  onClick={() => window.location.reload()} 
                  className="font-medium text-red-700 underline hover:text-red-600"
                >
                  Refresh page
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 relative">
      {showForm && (
        <TrainingExampleForm
          example={currentExample}
          onSave={handleSaveExample}
          onCancel={() => setShowForm(false)}
          ctiCategories={ctiCategories}
          ctiCategoriesLoading={ctiCategoriesLoading}
          ctiCategoriesError={ctiCategoriesError}
          onRetry={fetchCtiCategories}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-7 h-7 mr-3" />
            Training Examples Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage AI training data for ticket classification
          </p>
        </div>

        <button 
          onClick={handleAddExample}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Training Example
        </button>
      </div>

      {/* Training Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Examples</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total_examples || 0}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">From Corrections</p>
              <p className="text-2xl font-bold text-green-900">
                {stats.by_source?.find(s => s.source === 'correction')?.count || 0}
              </p>
            </div>
            <Edit className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Avg Weight</p>
              <p className="text-2xl font-bold text-purple-900">
                {(stats.avg_weight || 0).toFixed(1)}x
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700">Recent (30d)</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.recent_examples || 0}</p>
            </div>
            <Filter className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">All Sources</option>
              <option value="initial">Initial</option>
              <option value="correction">Corrections</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.cti_category}
              onChange={(e) => setFilters({ ...filters, cti_category: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">All Categories</option>
              {stats.top_cti_categories?.map(cat => (
                <option key={cat.correct_cti__category} value={cat.correct_cti__category}>
                  {cat.correct_cti__category} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search training content..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Training Examples Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading training examples...</p>
          </div>
        ) : examples.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No training examples found</h3>
            <p className="text-gray-500">No examples match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Content
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Correct CTI
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Weight
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {examples.map((example) => (
                  <tr key={example.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        <p className="truncate">{example.ticket_content}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{example.correct_cti.item}</p>
                        <p className="text-gray-500">{example.correct_cti.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getSourceBadge(example.source)}
                    </td>
                    <td className="px-4 py-4">
                      {getWeightIndicator(example.weight)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{example.created_at_formatted}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditExample(example);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(example.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingExamplesManager;
