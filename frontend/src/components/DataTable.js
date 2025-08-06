import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const DataTable = ({
  columns,
  fetchData,
  onRowClick,
  rowKey = 'id',
  searchable = true,
  pagination = true,
  pageSize = 10,
  actions = []
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        ...filters
      };
      
      if (sortConfig.key) {
        params.ordering = sortConfig.direction === 'desc' ? `-${sortConfig.key}` : sortConfig.key;
      }

      const response = await fetchData(params);
      setData(response.results || response);
      setTotalItems(response.count || response.length || 0);
    } catch (error) {
      console.error('Error loading table data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, sortConfig, filters, fetchData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Header with Search */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        {searchable && (
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        )}
        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center">
                    {column.header}
                    {sortConfig.key === column.key && (
                      <span className="ml-1">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions.length > 0 && (
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="px-6 py-4 text-center text-sm text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="px-6 py-4 text-center text-sm text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr 
                  key={item[rowKey]} 
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {columns.map((column) => (
                    <td key={`${item[rowKey]}-${column.key}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {column.render ? column.render(item) : item[column.key]}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(item);
                            }}
                            className={`${action.variant === 'danger' 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-blue-600 hover:text-blue-900'} font-medium`}
                            title={action.label}
                          >
                            {action.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalItems)}
                </span>{' '}
                of <span className="font-medium">{totalItems}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">First</span>
                  <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Last</span>
                  <ChevronsRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
