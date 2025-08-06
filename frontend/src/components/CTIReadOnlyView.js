import React, { useState, useEffect, useCallback } from 'react';
import { Database, Search, Eye, AlertCircle, ChevronUp, ChevronDown, Download, X } from 'lucide-react';
import APIService from '../services/api';
import debounce from 'lodash.debounce';

const CTIReadOnlyView = ({ user }) => {
  const [ctiRecords, setCtiRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({
    search: '',
    ordering: 'id', // Default sort by ID, matching backend
  });

  const fetchCTIRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = {
        page: pagination.currentPage,
        page_size: pagination.pageSize,
        search: filters.search,
        ordering: filters.ordering
      };
      
      const response = await APIService.getCTIRecordsReadOnly(params);
      
      setCtiRecords(response.results || []);
      setPagination(prev => ({
        ...prev,
        totalItems: response.count || 0,
        totalPages: Math.ceil((response.count || 0) / prev.pageSize),
      }));
      
    } catch (error) {
      console.error('Error fetching CTI records:', error);
      setCtiRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.pageSize]);

  // Use a debounced function for search to avoid excessive API calls
  const debouncedFetch = useCallback(debounce(fetchCTIRecords, 500), [fetchCTIRecords]);

  useEffect(() => {
    debouncedFetch();
    return () => debouncedFetch.cancel();
  }, [filters.search, filters.ordering, pagination.currentPage, pagination.pageSize, debouncedFetch]);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const newOrdering = direction === 'desc' ? `-${key}` : key;
    
    setSortConfig({ key, direction });
    setFilters(prev => ({ ...prev, ordering: newOrdering }));
    
    // Reset to first page when changing sort
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };
  
  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setPagination(prev => ({
      ...prev,
      pageSize: newSize,
      currentPage: 1,
    }));
  };
  
  const exportToCSV = async () => {
    try {
      setLoading(true);
      const response = await APIService.getCTIRecordsReadOnly({
        ...filters,
        page_size: 10000, // A large number to get all records
        page: 1,
        ordering: ''
      });
      
      const records = response.results || [];
      const headers = ['BU Number', 'Category', 'Type', 'Item', 'Resolver Group', 'Request Type', 'SLA', 'Service Description', 'BU Description', 'Resolver Group Description'];
      
      const csvContent = [
        headers.join(','),
        ...records.map(record => [
          `"${(record.bu_number || '').replace(/"/g, '""')}"`,
          `"${(record.category || '').replace(/"/g, '""')}"`,
          `"${(record.type || '').replace(/"/g, '""')}"`,
          `"${(record.item || '').replace(/"/g, '""')}"`,
          `"${(record.resolver_group || '').replace(/"/g, '""')}"`,
          `"${(record.request_type || '').replace(/"/g, '""')}"`,
          `"${(record.sla || '').replace(/"/g, '""')}"`,
          `"${(record.service_description || '').replace(/"/g, '""')}"`,
          `"${(record.bu_description || '').replace(/"/g, '""')}"`,
          `"${(record.resolver_group_description || '').replace(/"/g, '""')}"`,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute('download', `cti_records_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
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
          <div className="md:col-span-1">
            {/* Additional filters can go here */}
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
            <table className="w-full min-w-[1000px]">
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
                {ctiRecords.map((record) => (
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
                {ctiRecords.length === 0 && !loading && (
                  <tr>
                    <td colSpan="11" className="p-8 text-center text-gray-500">
                      No CTI records found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Show</span>
          <select 
            className="border rounded-md py-1 px-2"
            value={pagination.pageSize}
            onChange={handlePageSizeChange}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span>per page</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} records)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Description</h3>
              <button
                onClick={() => setShowDescriptionModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-grow">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedDescription || 'No description available'}
              </p>
            </div>
            <div className="mt-4 flex justify-end flex-shrink-0">
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