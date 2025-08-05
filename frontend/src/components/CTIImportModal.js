import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';

const CTIImportModal = ({ isOpen, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const importResult = await onImport(file);
      setResult(importResult);
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('csv-file-input');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      setError(error.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError('');
    setResult(null);
    setLoading(false);
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = `bu_number,bu_description,category,type,item,resolver_group,resolver_group_description,request_type,sla,service_description
753,Managed Workspace,Access Management,Password Reset,EOH Remote Support iOCO,Incident,P3,"Password reset assistance for user accounts"
753,Managed Workspace,Access Management,Profile - AD,EOH MYHR-AD Support iOCO,Request,P4,"Active Directory profile management and configuration"
753,End User Computing,Hardware Support,Laptop Issues,EOH Hardware Support iOCO,Incident,P3,"Physical laptop hardware problems and repairs"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cti_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Import CTI Records</h2>
              <p className="text-sm text-gray-600">Upload CSV file to bulk import CTI records</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Need a template?</p>
                <p className="text-xs text-blue-700">Download a sample CSV file with the correct format</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex items-center"
              >
                <Download className="w-3 h-3 mr-1" />
                Template
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select a CSV file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Required columns: category, type, item, resolver_group, request_type, sla
                  <br />Optional: bu_number, bu_description, resolver_group_description, service_description
                </p>
              </label>
            </div>
          </div>

          {/* CSV Format Info */}
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-2">CSV Format Requirements:</p>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• <strong>category</strong>: Service category (required)</li>
              <li>• <strong>type</strong>: Service type (required)</li>
              <li>• <strong>item</strong>: Specific item description (required)</li>
              <li>• <strong>resolver_group</strong>: Responsible team (required)</li>
              <li>• <strong>resolver_group_description</strong>: Details about the resolver group (optional)</li>
              <li>• <strong>request_type</strong>: Incident, Request, Change, Problem (required)</li>
              <li>• <strong>sla</strong>: P1, P2, P3, P4 (required)</li>
              <li>• <strong>bu_number</strong>: Business unit number (optional)</li>
              <li>• <strong>bu_description</strong>: Business unit description (optional)</li>
              <li>• <strong>service_description</strong>: Detailed service description (optional)</li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
              <div className="flex items-center mb-2">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <p className="text-sm font-medium text-green-900">Import Completed</p>
              </div>
              <div className="text-xs text-green-800 space-y-1">
                <p>• Created: {result.created_count} records</p>
                <p>• Updated: {result.updated_count} records</p>
                {result.error_count > 0 && (
                  <p>• Errors: {result.error_count} records</p>
                )}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 max-h-20 overflow-y-auto">
                  <p className="text-xs font-medium text-green-900 mb-1">Errors:</p>
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-xs text-green-700">• {error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CTIImportModal;
