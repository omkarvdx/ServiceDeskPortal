import React, { useState } from 'react';
import { X, Edit, CheckCircle } from 'lucide-react';
import CTISelector from './CTISelector';

const BulkActionsModal = ({ isOpen, onClose, selectedCount, onAction, filterOptions }) => {
  const [actionType, setActionType] = useState('assign');
  const [formData, setFormData] = useState({
    assigned_to_id: '',
    status: '',
    cti_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let actionData = {};
      
      if (actionType === 'assign') {
        actionData = { assigned_to_id: formData.assigned_to_id || null };
      } else if (actionType === 'status') {
        actionData = { status: formData.status };
      } else if (actionType === 'classify') {
        actionData = { cti_id: formData.cti_id };
      }

      await onAction(actionType, actionData);
      onClose();
      setFormData({ assigned_to_id: '', status: '', cti_id: '' });
    } catch (error) {
      setError(error.message || 'Failed to perform bulk action');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setFormData({ assigned_to_id: '', status: '', cti_id: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Edit className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Actions</h2>
              <p className="text-sm text-gray-600">{selectedCount} tickets selected</p>
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
              <option value="assign">Assign to User</option>
              <option value="status">Change Status</option>
              <option value="classify">Bulk Classify</option>
            </select>
          </div>

          {actionType === 'assign' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign To
              </label>
              <select
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {filterOptions.support_engineers?.map(engineer => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.first_name} {engineer.last_name} ({engineer.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          {actionType === 'status' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}

          {actionType === 'classify' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Classification
              </label>
              <CTISelector
                value={formData.cti_id}
                onChange={(value) => setFormData({ ...formData, cti_id: value })}
                showSearch={true}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This action will be applied to all {selectedCount} selected tickets.
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Apply Action
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkActionsModal;
