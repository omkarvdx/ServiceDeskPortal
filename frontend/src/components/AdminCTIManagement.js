import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Settings,
  Zap,
  AlertCircle,
  X
} from 'lucide-react';
import APIService from '../services/api';
import CTIEditModal from './CTIEditModal';
import CTIBulkActionsModal from './CTIBulkActionsModal';
import CTIImportModal from './CTIImportModal';
import EnhancedCTIStatsWidget from './CTIStatsWidget';
import AccessDenied from './AccessDenied';
import SmartRecommendations from './admin/SmartRecommendations';

const KeyboardShortcutsHelp = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl+N', description: 'Create new CTI record' },
    { key: 'Ctrl+F', description: 'Focus search input' },
    { key: 'Ctrl+R', description: 'Refresh data' },
    { key: 'Enter', description: 'Save inline edit' },
    { key: 'Escape', description: 'Cancel inline edit' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map((shortcut, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{shortcut.description}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const CTITrainingExamplesSection = ({ ctiRecord }) => {
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTrainingExamples = async () => {
    setLoading(true);
    try {
      const data = await APIService.request(`/cti/${ctiRecord.id}/training-examples/`);
      setExamples(data.training_examples);
    } catch (error) {
      console.error('Error fetching training examples:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ctiRecord) {
      fetchTrainingExamples();
    }
  }, [ctiRecord]);

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-yellow-900 mb-3 flex items-center">
        <BookOpen className="w-4 h-4 mr-2" />
        Training Examples ({examples.length})
      </h4>
      {loading ? (
        <p className="text-xs text-yellow-700">Loading training examples...</p>
      ) : examples.length === 0 ? (
        <p className="text-xs text-yellow-700">No training examples for this CTI record</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {examples.slice(0, 3).map((example, i) => (
            <div key={i} className="bg-white rounded p-2 border border-yellow-200">
              <p className="text-xs text-gray-700 mb-1">
                {example.ticket_content.substring(0, 100)}...
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className={`px-1 py-0.5 rounded font-medium ${
                  example.source === 'correction' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {example.source}
                </span>
                <span className="text-gray-500">Weight: {example.weight}x</span>
              </div>
            </div>
          ))}
          {examples.length > 3 && (
            <p className="text-xs text-yellow-600">+ {examples.length - 3} more examples</p>
          )}
        </div>
      )}
    </div>
  );
};

const AdminCTIManagement = ({ user }) => {
  const [ctiRecords, setCtiRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    current_page: 1,
    total_pages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    type: '',
    resolver_group: '',
    request_type: '',
    sla: '',
    has_embedding: '',
    usage: '',
    ordering: '-updated_at',
    page: 1,
    page_size: 25
  });
  const [filterOptions, setFilterOptions] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  const fetchCTIRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      // Create params object with all filters, removing empty values
      const params = new URLSearchParams();
      
      // Add all non-empty filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value);
        }
      });
      
      // Ensure page and page_size are always included
      if (!params.has('page')) {
        params.append('page', filters.page || 1);
      }
      if (!params.has('page_size')) {
        params.append('page_size', filters.page_size || 25);
      }
      
      console.log('Fetching CTI records with params:', params.toString());
      
      const response = await APIService.request(`/admin/cti/?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // Handle paginated response
      if (response.results) {
        setCtiRecords(response.results);
        setPagination({
          count: response.count,
          next: response.next,
          previous: response.previous,
          current_page: Number(filters.page) || 1,
          total_pages: Math.ceil(response.count / (filters.page_size || 25))
        });
        setStats(response.stats || {});
      } else {
        // Fallback for non-paginated response (shouldn't happen with current backend)
        setCtiRecords(response);
        setPagination(prev => ({
          ...prev,
          count: response.length,
          current_page: 1,
          total_pages: 1
        }));
      }
    } catch (error) {
      console.error('Error fetching CTI records:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (user.role === 'admin') {
      fetchCTIRecords();
      fetchFilterOptions();
    }
  }, [fetchCTIRecords, user.role]);

  const fetchFilterOptions = async () => {
    try {
      const options = await APIService.request('/admin/cti/filter-options/');
      setFilterOptions(options);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const handleRecordSelect = (recordId, checked) => {
    const newSelected = new Set(selectedRecords);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRecords(new Set(ctiRecords.map(r => r.id)));
    } else {
      setSelectedRecords(new Set());
    }
  };

  const handleStatClick = useCallback((statType) => {
    let newFilters = { ...filters };

    switch (statType) {
      case 'missing_embeddings':
        newFilters.has_embedding = 'false';
        break;
      case 'has_embeddings':
        newFilters.has_embedding = 'true';
        break;
      case 'used':
        newFilters.usage = 'used';
        break;
      case 'total':
        newFilters = {
          search: '',
          category: '',
          type: '',
          resolver_group: '',
          request_type: '',
          sla: '',
          has_embedding: '',
          usage: '',
          ordering: '-updated_at',
          page: 1,
          page_size: 25
        };
        break;
    }

    setFilters(newFilters);
  }, [filters, setFilters]);

  const startInlineEdit = useCallback((recordId, field, currentValue) => {
    setEditingCell({ recordId, field });
    setEditValue(currentValue || '');
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!editingCell) return;

    try {
      await APIService.updateCTIRecord(editingCell.recordId, {
        [editingCell.field]: editValue
      });

      setEditingCell(null);
      setEditValue('');
      fetchCTIRecords();
    } catch (error) {
      console.error('Error saving inline edit:', error);
      alert('Failed to save changes');
    }
  }, [editingCell, editValue, fetchCTIRecords]);

  const cancelInlineEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const EditableCell = ({ record, field, value, type = 'text' }) => {
    const isEditing = editingCell?.recordId === record.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-1">
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveInlineEdit();
              if (e.key === 'Escape') cancelInlineEdit();
            }}
            autoFocus
          />
          <button
            onClick={saveInlineEdit}
            className="text-green-600 hover:text-green-800 p-1"
            title="Save"
          >
            ✓
          </button>
          <button
            onClick={cancelInlineEdit}
            className="text-red-600 hover:text-red-800 p-1"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <div
        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        onClick={() => startInlineEdit(record.id, field, value)}
        title="Click to edit"
      >
        {value || <span className="text-gray-400 italic">Click to add</span>}
      </div>
    );
  };

  const useKeyboardShortcuts = () => {
    useEffect(() => {
      const handleKeyDown = (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
          return;
        }

        if (event.ctrlKey || event.metaKey) {
          switch (event.key) {
            case 'n':
              event.preventDefault();
              handleCreate();
              break;
            case 'f':
              event.preventDefault();
              document.querySelector('input[placeholder*="Search"]')?.focus();
              break;
            case 'r':
              event.preventDefault();
              fetchCTIRecords();
              break;
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  const handleCreate = () => {
    setEditingRecord(null);
    setShowEditModal(true);
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this CTI record?')) {
      return;
    }

    try {
      await APIService.request(`/admin/cti/${recordId}/`, {
        method: 'DELETE'
      });
      await fetchCTIRecords();
    } catch (error) {
      console.error('Error deleting CTI record:', error);
      alert('Failed to delete CTI record. It may be in use by tickets.');
    }
  };

  const handleRegenerateEmbedding = async (recordId) => {
    try {
      const response = await APIService.request(`/admin/cti/${recordId}/regenerate-embedding/`, {
        method: 'POST'
      });
      
      if (response.success) {
        await fetchCTIRecords();
        alert('Embedding regenerated successfully');
      } else {
        alert('Failed to regenerate embedding: ' + response.message);
      }
    } catch (error) {
      console.error('Error regenerating embedding:', error);
      alert('Failed to regenerate embedding');
    }
  };

  const handleBulkAction = async (action, data = {}) => {
    try {
      const recordIds = Array.from(selectedRecords);
      if (recordIds.length === 0) {
        alert('Please select at least one record');
        return;
      }

      // Get CSRF token from cookie
      const csrfToken = getCookie('csrftoken');
      if (!csrfToken) {
        throw new Error('CSRF token not found in cookies. Please refresh the page.');
      }

      // Prepare the request body
      const requestBody = {
        cti_ids: recordIds,
        action: action,
        ...data
      };

      console.log('Sending bulk action request:', {
        url: 'http://localhost:8000/api/admin/cti/bulk-actions/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(requestBody)
      });

      // Make the request directly to the backend URL
      const response = await fetch('http://localhost:8000/api/admin/cti/bulk-actions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = {};
      }

      console.log('Bulk action response:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      if (!response.ok) {
        // Handle specific error for records in use
        if (response.status === 400 && responseData.detail && responseData.detail.includes('in use')) {
          throw new Error(`Cannot delete records that are in use. ${responseData.detail}`);
        }
        throw new Error(responseData.detail || responseData.message || `HTTP error! status: ${response.status}`);
      }

      // Clear selection and refresh data
      setSelectedRecords(new Set());
      await fetchCTIRecords();
      
      // Show success message
      alert(responseData.message || 'Bulk action completed successfully');
      
    } catch (error) {
      console.error('Error performing bulk action:', {
        error: error.message,
        stack: error.stack,
        response: error.response
      });
      
      // Handle specific error cases
      if (error.message.toLowerCase().includes('csrf') || error.message.includes('CSRF')) {
        alert('CSRF validation failed. Please refresh the page and try again.');
        window.location.reload();
      } else {
        // Show the error message from the server
        alert(error.message || 'An error occurred during bulk action');
      }
    }
  };

  // Helper function to get cookie by name
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  // Ensure we have a valid CSRF token
  const ensureCSRFToken = async () => {
    // First try to get from meta tag
    let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // If not in meta tag, try to get from cookies
    if (!csrfToken) {
      csrfToken = getCookie('csrftoken');
    }
    
    // If still not found, try to fetch it
    if (!csrfToken) {
      try {
        const response = await fetch('/api/csrf/', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          csrfToken = data.csrfToken;
        }
      } catch (e) {
        console.error('Failed to fetch CSRF token:', e);
      }
    }
    
    if (!csrfToken) {
      throw new Error('Failed to obtain CSRF token');
    }
    
    return csrfToken;
  };
  const handleImport = async (file, options) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(options));
      
      // Get CSRF token from cookie
      const csrfToken = getCookie('csrftoken');
      if (!csrfToken) {
        // If no CSRF token in cookie, try to get a new one
        await fetch('http://localhost:8000/api/csrf/', {
          method: 'GET',
          credentials: 'include',
        });
        // Try to get CSRF token again after refresh
        const newCsrfToken = getCookie('csrftoken');
        if (!newCsrfToken) {
          throw new Error('CSRF token not found in cookies after refresh');
        }
      }

      console.log('Sending import request to backend...');
      
      // Make the request directly to the backend URL
      const response = await fetch('http://localhost:8000/api/admin/cti/import-csv/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken || getCookie('csrftoken'),
        },
        credentials: 'include',
        body: formData
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = {};
      }

      console.log('Import response:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });

      if (!response.ok) {
        throw new Error(responseData.detail || responseData.message || `HTTP error! status: ${response.status}`);
      }
      
      if (responseData.success) {
        setSuccessMessage('CTI records imported successfully!');
        setShowSuccess(true);
        await fetchCTIRecords();
      } else {
        throw new Error(responseData.message || 'Failed to import CTI records');
      }
    } catch (error) {
      console.error('Error importing CTI records:', {
        error: error.message,
        stack: error.stack
      });
      setErrorMessage(error.message || 'Failed to import CTI records');
      setShowError(true);
      
      if (error.message.toLowerCase().includes('csrf')) {
        // If CSRF error, suggest refreshing the page
        if (window.confirm('Your session may have expired. Would you like to refresh the page?')) {
          window.location.reload();
        }
      }
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      );
      
      // Get CSRF token for the request
      const csrfToken = APIService.getCSRFToken();
      
      // Make the request to get the CSV data
      const response = await fetch(`${APIService.baseURL}/admin/cti/export-csv/?${params}`, {
        method: 'GET',
        headers: {
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }
      
      // Get the filename from the Content-Disposition header or use a default name
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'cti-export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setFilters(prevFilters => ({
        ...prevFilters,
        page: newPage
      }));
      
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pagination.total_pages]);

  const getEmbeddingBadge = (hasEmbedding) => {
    return hasEmbedding ? (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
        <Zap className="w-3 h-3 mr-1" />
        Embedded
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Missing
      </span>
    );
  };

  const getUsageBadge = (predictedCount, correctedCount) => {
    const total = predictedCount + correctedCount;
    if (total === 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
          Unused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
        {total} tickets
      </span>
    );
  };

  useKeyboardShortcuts();

  if (user.role !== 'admin') {
    return <AccessDenied />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Database className="w-7 h-7 mr-3" />
            CTI Master Data Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage Configuration and Taxonomy Information records with AI embeddings
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add CTI Record
          </button>
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Keyboard Shortcuts (Ctrl+?)"
          >
            ⌨️
          </button>
        </div>
      </div>

      {/* Stats Widget */}
      <EnhancedCTIStatsWidget stats={stats} onStatClick={handleStatClick} />

      {/* NEW: Smart Recommendations Widget */}
      {showRecommendations && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
            <button
              onClick={() => setShowRecommendations(false)}
              className="text-gray-400 hover:text-gray-600"
              title="Hide recommendations"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <SmartRecommendations />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {filterOptions.categories?.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {filterOptions.types?.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resolver Group</label>
            <select
              value={filters.resolver_group}
              onChange={(e) => setFilters({ ...filters, resolver_group: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Groups</option>
              {filterOptions.resolver_groups?.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Request Type</label>
            <select
              value={filters.request_type}
              onChange={(e) => setFilters({ ...filters, request_type: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Request Types</option>
              <option value="Incident">Incident</option>
              <option value="Request">Request</option>
              <option value="Change">Change</option>
              <option value="Problem">Problem</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Embeddings</label>
            <select
              value={filters.has_embedding}
              onChange={(e) => setFilters({ ...filters, has_embedding: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {filterOptions.embedding_options?.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usage</label>
            <select
              value={filters.usage}
              onChange={(e) => setFilters({ ...filters, usage: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {filterOptions.usage_options?.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={filters.ordering}
              onChange={(e) => setFilters({ ...filters, ordering: e.target.value, page: 1 })}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="-updated_at">Recently Updated</option>
              <option value="-created_at">Recently Created</option>
              <option value="category">Category A-Z</option>
              <option value="-category">Category Z-A</option>
              <option value="type">Type A-Z</option>
              <option value="item">Item A-Z</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories, types, items, BU numbers, descriptions..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {selectedRecords.size > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Bulk Actions ({selectedRecords.size})
            </button>
          )}
        </div>
      </div>

      {/* CTI Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading CTI records...</p>
          </div>
        ) : ctiRecords.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No CTI records found</h3>
            <p className="text-gray-500">No records match your current filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
              <table className="w-full min-w-[1400px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="w-8 px-3 py-3 sticky left-0 bg-gray-50 z-10">
                      <input
                        type="checkbox"
                        checked={selectedRecords.size === ctiRecords.length && ctiRecords.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">BU Number</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">BU Description</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Category</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Type</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Item</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Resolver Group</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Resolver Group Description</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Request Type</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">SLA</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Service Description</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Few Shot Examples</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Embedding</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Usage</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Updated</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] sticky right-0 bg-gray-50 z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ctiRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 transition-colors ${selectedRecords.has(record.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-4 sticky left-0 bg-white z-10">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={(e) => handleRecordSelect(record.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <EditableCell record={record} field="bu_number" value={record.bu_number} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm text-gray-900 max-w-[150px] truncate" title={record.bu_description}>
                          <EditableCell record={record} field="bu_description" value={record.bu_description} />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <EditableCell record={record} field="category" value={record.category} />
                      </td>
                      <td className="px-3 py-4">
                        <EditableCell record={record} field="type" value={record.type} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm text-gray-900 max-w-[200px] truncate" title={record.item}>
                          <EditableCell record={record} field="item" value={record.item} />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <EditableCell record={record} field="resolver_group" value={record.resolver_group} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm text-gray-900 max-w-[200px] truncate" title={record.resolver_group_description}>
                          <EditableCell record={record} field="resolver_group_description" value={record.resolver_group_description} />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          record.request_type === 'Incident' ? 'bg-red-100 text-red-800' :
                          record.request_type === 'Request' ? 'bg-blue-100 text-blue-800' :
                          record.request_type === 'Change' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.request_type}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          record.sla === 'P1' ? 'bg-red-100 text-red-800' :
                          record.sla === 'P2' ? 'bg-orange-100 text-orange-800' :
                          record.sla === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {record.sla}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm text-gray-900 max-w-[200px] truncate" title={record.service_description}>
                          <EditableCell record={record} field="service_description" value={record.service_description} />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{record.example_count || 0} examples</div>
                          <div className="flex items-center">
                            {record.has_sufficient_examples ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">✓ Well-trained</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">⚠ Limited data</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">{getEmbeddingBadge(record.has_embedding)}</td>
                      <td className="px-3 py-4">{getUsageBadge(record.predicted_tickets_count, record.corrected_tickets_count)}</td>
                      <td className="px-3 py-4"><div className="text-sm text-gray-900">{record.updated_at_formatted}</div></td>
                      <td className="px-3 py-4 sticky right-0 bg-white z-10">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!record.has_embedding && (
                            <button
                              onClick={() => handleRegenerateEmbedding(record.id)}
                              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Generate Embedding"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Record"
                            disabled={record.predicted_tickets_count > 0 || record.corrected_tickets_count > 0}
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

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.current_page - 1) * filters.page_size) + 1} to{' '}
                  {Math.min(pagination.current_page * filters.page_size, pagination.count)} of{' '}
                  {pagination.count} results
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.current_page === 1}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                    disabled={!pagination.previous}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    title="Previous Page"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                      // Calculate page numbers to show (current page in the middle when possible)
                      let pageNum;
                      if (pagination.total_pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.current_page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.current_page >= pagination.total_pages - 2) {
                        pageNum = pagination.total_pages - 4 + i;
                      } else {
                        pageNum = pagination.current_page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                            pagination.current_page === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                    disabled={!pagination.next}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    title="Next Page"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.total_pages)}
                    disabled={pagination.current_page === pagination.total_pages}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
                
                <div className="flex items-center text-sm text-gray-700">
                  <span className="mr-2">Page Size:</span>
                  <select
                    value={filters.page_size}
                    onChange={(e) => {
                      setFilters(prev => ({
                        ...prev,
                        page_size: Number(e.target.value),
                        page: 1 // Reset to first page when changing page size
                      }));
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CTIEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        onSuccess={() => {
          setShowEditModal(false);
          setEditingRecord(null);
          fetchCTIRecords();
        }}
        filterOptions={filterOptions}
      />

      <CTIBulkActionsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        selectedCount={selectedRecords.size}
        onAction={handleBulkAction}
        filterOptions={filterOptions}
      />

      <CTIImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
};

export default AdminCTIManagement;
