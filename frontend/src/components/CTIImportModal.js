import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const CTIImportModal = ({ isOpen, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [fileType, setFileType] = useState(null); // 'csv' or 'xlsx'

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop().toLowerCase();
      const isValidFile = ['csv', 'xlsx', 'xls'].includes(fileExt);
      
      if (!isValidFile) {
        setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }
      
      setFile(selectedFile);
      setFileType(fileExt === 'xls' ? 'xlsx' : fileExt); // Normalize xls to xlsx
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
      let fileToSend = file;
      const fileExt = file.name.split('.').pop().toLowerCase();
      
      // If Excel file, validate the structure before sending
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Basic validation - check if all columns exist
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const allColumns = [
            'category', 'type', 'item', 'resolver_group', 'resolver_group_description', 
            'request_type', 'sla', 'bu_number', 'bu_description', 'service_description'
          ];
          const missingColumns = allColumns.filter(column => !(column in firstRow));
          
          if (missingColumns.length > 0) {
            throw new Error(`Missing columns in the file: ${missingColumns.join(', ')}`);
          }
        }
      }
      
      const importResult = await onImport(file);
      setResult(importResult);
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('cti-file-input');
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

  const [showTemplateOptions, setShowTemplateOptions] = useState(false);

  const downloadTemplate = (format) => {
    if (format === 'xlsx') {
      // Create Excel workbook with sample data
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['category', 'type', 'item', 'resolver_group', 'resolver_group_description', 'request_type', 'sla', 'bu_number', 'bu_description', 'service_description'],
        ['Access Management', 'Password Reset', 'Password Reset for User Account', 'EOH Remote Support iOCO', 'Handles all password related issues', 'Incident', 'P3', 753, 'Managed Workspace', 'Password reset assistance for user accounts'],
        ['Access Management', 'Account Unlock', 'AD Account Unlock', 'EOH MYHR-AD Support iOCO', 'Manages Active Directory accounts', 'Request', 'P4', 753, 'Managed Workspace', 'Unlock Active Directory user account'],
        ['End User Computing', 'Hardware Support', 'Laptop Hardware Issues', 'EOH Hardware Support iOCO', 'Handles all laptop hardware related issues', 'Incident', 'P3', 753, 'End User Computing', 'Physical laptop hardware problems and repairs']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'CTI Template');
      XLSX.writeFile(wb, 'cti_template.xlsx');
    } else {
      // Default to CSV format
      const csvContent = `category,type,item,resolver_group,resolver_group_description,request_type,sla,bu_number,bu_description,service_description
Access Management,Password Reset,Password Reset for User Account,EOH Remote Support iOCO,Handles all password related issues,Incident,P3,753,Managed Workspace,Password reset assistance for user accounts
Access Management,Account Unlock,AD Account Unlock,EOH MYHR-AD Support iOCO,Manages Active Directory accounts,Request,P4,753,Managed Workspace,Unlock Active Directory user account
End User Computing,Hardware Support,Laptop Hardware Issues,EOH Hardware Support iOCO,Handles all laptop hardware related issues,Incident,P3,753,End User Computing,Physical laptop hardware problems and repairs`;
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cti_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
    setShowTemplateOptions(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] flex flex-col fade-in">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Upload className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import CTI Records</h2>
                <p className="text-sm text-gray-600">Upload CSV or Excel file to bulk import CTI records</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
            <div className="flex items-center space-x-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Need a template?</p>
                <p className="text-xs text-blue-700">Download a sample file with the correct format</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTemplateOptions(!showTemplateOptions)}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Template
                </button>
                {showTemplateOptions && (
                <div 
                  className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200"
                  onMouseLeave={() => setShowTemplateOptions(false)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTemplate('csv');
                    }}
                    className="block w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Download as CSV
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTemplate('xlsx');
                    }}
                    className="block w-full text-left px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Download as Excel
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV or Excel File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                id="cti-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="cti-file-input" className="cursor-pointer">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select a CSV or Excel file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Required columns: category, type, item, resolver_group, request_type, sla, bu_number, bu_description, resolver_group_description, service_description
                </p>
              </label>
            </div>
          </div>

          {/* CSV Format Info - Collapsible */}
          <div className="mb-4">
            <details className="group">
              <summary className="flex justify-between items-center p-2 bg-gray-50 rounded-lg cursor-pointer">
                <span className="text-sm font-medium text-gray-900">CSV/Excel Format Requirements</span>
                <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-2 p-2 bg-gray-50 rounded-b-lg">
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
            </details>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded-lg">
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
        </div>
        
        {/* Footer with Action Buttons */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                    Import CTI
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