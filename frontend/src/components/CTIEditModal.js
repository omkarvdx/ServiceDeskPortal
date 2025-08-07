import React, { useState, useEffect } from 'react';
import { X, Save, Zap, Database, AlertCircle } from 'lucide-react';
import APIService from '../services/api';

const CTIEditModal = ({ isOpen, onClose, record, onSuccess, filterOptions }) => {
  const [formData, setFormData] = useState({
    bu_number: '',
    category: '',
    type: '',
    item: '',
    resolver_group: '',
    request_type: '',
    sla: '',
    service_description: '',
    bu_description: '',
    resolver_group_description: '',
    auto_generate_embedding: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (record) {
      setFormData({
        bu_number: record.bu_number || '',
        category: record.category || '',
        type: record.type || '',
        item: record.item || '',
        resolver_group: record.resolver_group || '',
        request_type: record.request_type || '',
        sla: record.sla || '',
        service_description: record.service_description || '',
        bu_description: record.bu_description || '',
        resolver_group_description: record.resolver_group_description || '',
        auto_generate_embedding: true
      });
    } else {
      setFormData({
        bu_number: '',
        category: '',
        type: '',
        item: '',
        resolver_group: '',
        request_type: '',
        sla: '',
        service_description: '',
        bu_description: '',
        resolver_group_description: '',
        auto_generate_embedding: true
      });
    }
    setError('');
    setValidationErrors({});
  }, [record, isOpen]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    }
    if (!formData.type.trim()) {
      errors.type = 'Type is required';
    }
    if (!formData.item.trim()) {
      errors.item = 'Item is required';
    }
    if (!formData.resolver_group.trim()) {
      errors.resolver_group = 'Resolver Group is required';
    }
    if (!formData.request_type.trim()) {
      errors.request_type = 'Request Type is required';
    }
    if (!formData.sla.trim()) {
      errors.sla = 'SLA is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = record ? `/api/admin/cti/${record.id}/` : '/api/admin/cti/';
      const method = record ? 'PUT' : 'POST';

      await APIService.request(endpoint, {
        method,
        body: JSON.stringify(formData)
      });

      onSuccess();
    } catch (error) {
      setError(error.message || 'Failed to save CTI record');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setValidationErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {record ? 'Edit CTI Record' : 'Create CTI Record'}
              </h2>
              <p className="text-sm text-gray-600">
                {record ? 'Update the configuration and taxonomy information' : 'Add new configuration and taxonomy information'}
              </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              BU Number
            </label>
            <input
              type="text"
              value={formData.bu_number}
              onChange={(e) => setFormData({ ...formData, bu_number: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                validationErrors.bu_number ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., 753"
            />
            {validationErrors.bu_number && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.bu_number}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              BU Description
            </label>
            <textarea
              value={formData.bu_description}
              onChange={(e) => setFormData({ ...formData, bu_description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Description for this BU"
            />
          </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.category ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Managed Workspace"
                required
                list="categories"
              />
              <datalist id="categories">
                {filterOptions.categories?.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              {validationErrors.category && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.category}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.type ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Access Management"
                required
                list="types"
              />
              <datalist id="types">
                {filterOptions.types?.map(type => (
                  <option key={type} value={type} />
                ))}
              </datalist>
              {validationErrors.type && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.type}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SLA <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.sla}
                onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.sla ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select SLA</option>
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
              </select>
              {validationErrors.sla && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.sla}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.item}
              onChange={(e) => setFormData({ ...formData, item: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                validationErrors.item ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Password Reset"
              required
            />
            {validationErrors.item && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.item}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolver Group <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.resolver_group}
              onChange={(e) => setFormData({ ...formData, resolver_group: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                validationErrors.resolver_group ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., EOH Remote Support iOCO"
              required
              list="resolver_groups"
            />
            <datalist id="resolver_groups">
              {filterOptions.resolver_groups?.map(group => (
                <option key={group} value={group} />
              ))}
            </datalist>
            {validationErrors.resolver_group && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.resolver_group}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolver Group Description
            </label>
            <textarea
              value={formData.resolver_group_description}
              onChange={(e) => setFormData({ ...formData, resolver_group_description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Description for this resolver group"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.request_type}
              onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                validationErrors.request_type ? 'border-red-300' : 'border-gray-300'
              }`}
              required
            >
              <option value="">Select Request Type</option>
              <option value="Incident">Incident</option>
              <option value="Request">Request</option>
              <option value="Change">Change</option>
              <option value="Problem">Problem</option>
            </select>
            {validationErrors.request_type && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.request_type}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Description
            </label>
            <textarea
              value={formData.service_description}
              onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                validationErrors.service_description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Detailed description of this service item"
            />
            {validationErrors.service_description && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.service_description}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto_generate_embedding"
              checked={formData.auto_generate_embedding}
              onChange={(e) => setFormData({ ...formData, auto_generate_embedding: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="auto_generate_embedding" className="text-sm text-gray-700 flex items-center">
              <Zap className="w-4 h-4 mr-1 text-blue-500" />
              Auto-generate AI embedding
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> {record ? 'Updating' : 'Creating'} this record will automatically generate an AI embedding for better ticket classification.
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {record ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {record ? 'Update Record' : 'Create Record'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CTIEditModal;
