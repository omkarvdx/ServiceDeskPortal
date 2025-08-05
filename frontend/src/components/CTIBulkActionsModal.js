import React, { useState } from 'react';
import { X, Settings, Zap, Trash2, Edit, CheckCircle } from 'lucide-react';

const CTIBulkActionsModal = ({ isOpen, onClose, selectedCount, onAction, filterOptions }) => {
  const [actionType, setActionType] = useState('regenerate_embeddings');
  const [formData, setFormData] = useState({
    resolver_group: '',
    request_type: '',
    sla: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let actionData = {};
      
      if (actionType === 'bulk_update') {
        // Only include non-empty fields
        Object.keys(formData).forEach(key => {
          if (formData[key]) {
            actionData[key] = formData[key];
          }
        });
        
        if (Object.keys(actionData).length === 0) {
          setError('Please select at least one field to update');
          setLoading(false);
          return;
        }
      }

      await onAction(actionType, actionData);
      onClose();
      setFormData({ resolver_group: '', request_type: '', sla: '' });
    } catch (error) {
      setError(error.message || 'Failed to perform bulk action');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setFormData({ resolver_group: '', request_type: '', sla: '' });
    onClose();
  };

  if (!isOpen) return null;

  const getActionIcon = () => {
    switch (actionType) {
      case 'regenerate_embeddings':
        return <Zap className="w-5 h-5 text-green-600" />;
      case 'delete':
        return <Trash2 className="w-5 h-5 text-red-600" />;
      case 'bulk_update':
        return <Edit className="w-5 h-5 text-blue-600" />;
      default:
        return <Settings className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'regenerate_embeddings':
        return 'Regenerate AI embeddings for all selected CTI records. This will improve classification accuracy.';
      case 'delete':
        return 'Permanently delete selected CTI records. Records in use by tickets cannot be deleted.';
      case 'bulk_update':
        return 'Update common fields for all selected CTI records. Only specified fields will be changed.';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-lg">
              {getActionIcon()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Actions</h2>
              <p className="text-sm text-gray-600">{selectedCount} records selected</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action Type
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="regenerate_embeddings">Regenerate Embeddings</option>
              <option value="bulk_update">Bulk Update Fields</option>
              <option value="delete">Delete Records</option>
            </select>
          </div>

          {actionType === 'bulk_update' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolver Group (Optional)
                </label>
                <input
                  type="text"
                  value={formData.resolver_group}
                  onChange={(e) => setFormData({ ...formData, resolver_group: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty to keep existing values"
                  list="resolver_groups"
                />
                <datalist id="resolver_groups">
                  {filterOptions.resolver_groups?.map(group => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Type (Optional)
                </label>
                <select
                  value={formData.request_type}
                  onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keep existing values</option>
                  <option value="Incident">Incident</option>
                  <option value="Request">Request</option>
                  <option value="Change">Change</option>
                  <option value="Problem">Problem</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SLA (Optional)
                </label>
                <select
                  value={formData.sla}
                  onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keep existing values</option>
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className={`border p-3 rounded-lg ${
            actionType === 'delete' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          }`}>
            <p className={`text-sm ${actionType === 'delete' ? 'text-red-800' : 'text-blue-800'}`}>
              <strong>Action:</strong> {getActionDescription()}
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center ${
                actionType === 'delete' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Execute Action
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CTIBulkActionsModal;
