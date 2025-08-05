import React, { useState, useEffect } from 'react';
import { Database, Search, Eye, AlertCircle, ChevronUp, ChevronDown, Download, X } from 'lucide-react';
import APIService from '../services/api';

const CTIReadOnlyView = ({ user }) => {
  const [ctiRecords, setCtiRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    type: '',
    resolver_group: '',
  });

  useEffect(() => {
    fetchCTIRecords();
  }, [filters]);

  const fetchCTIRecords = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      const response = await APIService.getCTIRecordsReadOnly(params);
      setCtiRecords(response);
    } catch (error) {
      console.error('Error fetching CTI records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = React.useMemo(() => {
    if (!sortConfig.key) return ctiRecords;

    return [...ctiRecords].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [ctiRecords, sortConfig]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp className="w-4 h-4 text-gray-400 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-blue-600" /> : 
      <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  const SortableHeader = ({ columnKey, children, className = "" }) => (
    <th 
      className={`text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon(columnKey)}
      </div>
    </th>
  );

  const handleDescriptionDoubleClick = (description) => {
    setSelectedDescription(description);
    setShowDescriptionModal(true);
  };

  const exportToCSV = () => {
    const headers = ['BU Number', 'Category', 'Type', 'Item', 'Resolver Group', 'Request Type', 'SLA', 'Service Description', 'BU Description', 'Resolver Group Description'];
    const csvContent = [
      headers.join(','),
      ...sortedRecords.map(record => [
        record.bu_number || '',
        record.category || '',
        record.type || '',
        record.item || '',
        record.resolver_group || '',
        record.request_type || '',
        record.sla || '',
        `"${(record.service_description || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${(record.bu_description || '').replace(/"/g, '""')}"`,
        `"${(record.resolver_group_description || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cti_records_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Database className="w-7 h-7 mr-3" />
            CTI Records (Read-Only)
          </h1>
          <p className="text-gray-600 mt-1">
            View Configuration and Taxonomy Information records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
            <div className="flex items-center text-blue-700">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Read-Only Access</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Contact admin to modify CTI records
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search CTI records..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading CTI records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader columnKey="bu_number">BU Number</SortableHeader>
                  <SortableHeader columnKey="category">Category</SortableHeader>
                  <SortableHeader columnKey="type">Type</SortableHeader>
                  <SortableHeader columnKey="item">Item</SortableHeader>
                  <SortableHeader columnKey="resolver_group">Resolver Group</SortableHeader>
                  <SortableHeader columnKey="request_type">Request Type</SortableHeader>
                  <SortableHeader columnKey="sla">SLA</SortableHeader>
                  <SortableHeader columnKey="service_description">Service Description</SortableHeader>
                  <SortableHeader columnKey="bu_description">BU Description</SortableHeader>
                  <SortableHeader columnKey="resolver_group_description">Resolver Group Description</SortableHeader>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{record.bu_number || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{record.category}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{record.type}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{record.item}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{record.resolver_group}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{record.request_type || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.sla === 'P1' ? 'bg-red-100 text-red-800' :
                        record.sla === 'P2' ? 'bg-orange-100 text-orange-800' :
                        record.sla === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {record.sla || 'N/A'}
                      </span>
                    </td>
                    <td 
                      className="px-4 py-4 text-sm text-gray-900 max-w-xs cursor-pointer"
                      onDoubleClick={() => handleDescriptionDoubleClick(record.service_description)}
                      title="Double-click to view full description"
                    >
                      <div className="line-clamp-2">{record.service_description || '-'}</div>
                    </td>
                    <td 
                      className="px-4 py-4 text-sm text-gray-900 max-w-xs cursor-pointer"
                      onDoubleClick={() => handleDescriptionDoubleClick(record.bu_description)}
                      title="Double-click to view full description"
                    >
                      <div className="line-clamp-2">{record.bu_description || '-'}</div>
                    </td>
                    <td 
                      className="px-4 py-4 text-sm text-gray-900 max-w-xs cursor-pointer"
                      onDoubleClick={() => handleDescriptionDoubleClick(record.resolver_group_description)}
                      title="Double-click to view full description"
                    >
                      <div className="line-clamp-2">{record.resolver_group_description || '-'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedRecords.length === 0 && !loading && (
              <div className="p-8 text-center">
                <p className="text-gray-500">No CTI records found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Service Description</h3>
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-64">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedDescription || 'No description available'}
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CTIReadOnlyView;