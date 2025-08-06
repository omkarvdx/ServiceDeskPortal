import React, { useState, useMemo, useRef } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  Eye,
  Search,
  Download,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';

// UI Components
const Button = ({ children, className = '', variant = 'default', size = 'default', ...props }) => {
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200'
  };
  const sizes = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base'
  };
  return (
    <button 
      className={`font-medium rounded-md transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input 
    className={`border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
    {...props}
  />
);

const Dialog = ({ children, open, onOpenChange }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children }) => <div>{children}</div>;
const DialogHeader = ({ children }) => <div className="mb-4">{children}</div>;
const DialogTitle = ({ children }) => <h2 className="text-xl font-bold">{children}</h2>;

const Badge = ({ children, variant = 'default', className = '', ...props }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    secondary: 'bg-blue-100 text-blue-800'
  };
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

const Table = ({ children, className = '', ...props }) => (
  <div className="overflow-x-auto border border-gray-200 rounded-lg">
    <table 
      className={`w-full divide-y divide-gray-200 ${className}`}
      {...props}
    >
      {children}
    </table>
  </div>
);

const TableHeader = ({ children, ...props }) => <thead className="bg-gray-50" {...props}>{children}</thead>;
const TableBody = ({ children, ...props }) => <tbody className="bg-white divide-y divide-gray-200" {...props}>{children}</tbody>;
const TableRow = ({ children, ...props }) => <tr {...props}>{children}</tr>;
const TableHead = ({ children, className = '', ...props }) => (
  <th 
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${className}`}
    {...props}
  >
    {children}
  </th>
);
const TableCell = ({ children, className = '', ...props }) => (
  <td 
    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 last:border-r-0 ${className}`}
    {...props}
  >
    {children}
  </td>
);

// Mock constants
const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress', 
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

const STATUS_COLORS = {
  [TICKET_STATUS.OPEN]: 'bg-yellow-100 text-yellow-800',
  [TICKET_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [TICKET_STATUS.RESOLVED]: 'bg-green-100 text-green-800',
  [TICKET_STATUS.CLOSED]: 'bg-gray-100 text-gray-800'
};

const USER_ROLES = {
  END_USER: 'end_user',
  ADMIN: 'admin'
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    [TICKET_STATUS.OPEN]: { icon: Clock, label: 'Open' },
    [TICKET_STATUS.IN_PROGRESS]: { icon: AlertCircle, label: 'In Progress' },
    [TICKET_STATUS.RESOLVED]: { icon: CheckCircle, label: 'Resolved' },
    [TICKET_STATUS.CLOSED]: { icon: CheckCircle, label: 'Closed' },
  };

  const config = statusConfig[status] || statusConfig[TICKET_STATUS.OPEN];
  const Icon = config.icon;
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS[TICKET_STATUS.OPEN];

  return (
    <Badge variant="secondary" className={colorClass}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const JustificationCell = ({ justification }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!justification) {
    return <span className="text-gray-400">No justification</span>;
  }

  const truncated = justification.length > 50 
    ? `${justification.substring(0, 50)}...` 
    : justification;

  return (
    <>
      <div 
        className="cursor-pointer hover:bg-gray-100 p-2 rounded group min-w-0"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <span className="text-sm block">{truncated}</span>
        {justification.length > 50 && (
          <Eye className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prediction Justification</DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{justification}</p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

const SortableHeader = ({ children, sortKey, currentSort, onSort }) => {
  const isSorted = currentSort.key === sortKey;
  const direction = isSorted ? currentSort.direction : null;

  return (
    <TableHead 
      className="cursor-pointer hover:bg-gray-100 select-none group"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-between">
        <span>{children}</span>
        <div className="flex flex-col ml-1">
          <ChevronUp 
            className={`w-3 h-3 ${
              direction === 'asc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            }`} 
          />
          <ChevronDown 
            className={`w-3 h-3 -mt-1 ${
              direction === 'desc' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            }`} 
          />
        </div>
      </div>
    </TableHead>
  );
};

// Pagination component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5; // Show max 5 page numbers at a time
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, current page, and pages around it
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = startPage + maxVisiblePages - 1;
      
      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push('...');
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-gray-200">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
            currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
            currentPage === totalPages || totalPages === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * 10, totalPages * 10)}
            </span>{' '}
            of <span className="font-medium">{totalPages * 10}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="sr-only">First</span>
              <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium ${
                currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  page === currentPage
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                } ${page === '...' ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium ${
                currentPage === totalPages || totalPages === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                currentPage === totalPages || totalPages === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="sr-only">Last</span>
              <ChevronsRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const TicketList = ({ 
  tickets, 
  onTicketClick, 
  userRole, 
  loading, 
  onImportComplete, 
  pagination = { currentPage: 1, totalPages: 1, totalItems: 0 },
  onPageChange = () => {}
}) => {
  const fileInputRef = useRef(null);
  
  const exportToCSV = () => {
    try {
      // Prepare the data for export
      const data = filteredAndSortedTickets.map(ticket => ({
        'Ticket ID': ticket.ticket_id,
        'Summary': ticket.summary || '',
        'Description': ticket.description || '',
        'Status': ticket.status || '',
        'Created At': ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '',
        'Category': ticket.final_cti?.category || '',
        'Type': ticket.final_cti?.type || '',
        'Item': ticket.final_cti?.item || '',
        'Resolver Group': ticket.final_cti?.resolver_group || '',
        'Request Type': ticket.final_cti?.request_type || '',
        'SLA': ticket.final_cti?.sla || 'N/A',
        'Justification': ticket.prediction_justification || ''
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
      
      // Generate the Excel file
      const fileName = `tickets_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Error exporting tickets:', error);
      alert('Failed to export tickets. Please try again.');
    }
  };
  
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Process the imported data (you might want to validate it first)
      console.log('Imported data:', jsonData);
      
      // If there's an onImportComplete prop, call it with the imported data
      if (onImportComplete) {
        onImportComplete(jsonData);
      }
      
      // Reset the file input
      e.target.value = null;
      
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Failed to import file. Please check the file format and try again.');
    }
  };
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    type: '',
    status: ''
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedTickets = useMemo(() => {
    let filtered = tickets.filter(ticket => {
      const matchesSearch = !filters.search || 
        ticket.summary?.toLowerCase().includes(filters.search.toLowerCase()) ||
        ticket.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        ticket.ticket_id?.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesCategory = !filters.category || 
        ticket.final_cti?.category === filters.category;
      
      const matchesType = !filters.type || 
        ticket.final_cti?.type === filters.type;
      
      const matchesStatus = !filters.status || 
        ticket.status === filters.status;

      return matchesSearch && matchesCategory && matchesType && matchesStatus;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle nested properties
        if (sortConfig.key.includes('.')) {
          const keys = sortConfig.key.split('.');
          aValue = keys.reduce((obj, key) => obj?.[key], a);
          bValue = keys.reduce((obj, key) => obj?.[key], b);
        }

        // Special handling for ticket_id to sort numerically
        if (sortConfig.key === 'ticket_id' && aValue && bValue) {
          // Extract numeric part from ticket_id (e.g., 'TKT-000153' -> 153)
          const getNumericPart = (id) => {
            const match = id.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          
          const aNum = getNumericPart(aValue);
          const bNum = getNumericPart(bValue);
          
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Default string comparison for other fields
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [tickets, filters, sortConfig]);

  const clearFilters = () => {
    setFilters({ search: '', category: '', type: '', status: '' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading tickets...</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">No tickets found</h3>
        <p className="text-gray-500">
          {userRole === USER_ROLES.END_USER 
            ? "You haven't created any tickets yet. Click 'New Ticket' to get started."
            : "No tickets match your current filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search tickets..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-64"
              />
            </div>
            <Input
              placeholder="Filter by category"
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-48"
            />
            <Input
              placeholder="Filter by type"
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="w-48"
            />
            <Input
              placeholder="Filter by status"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-48"
            />
          </div>
          {Object.values(filters).some(filter => filter) && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium">All Tickets ({filteredAndSortedTickets.length})</h2>
        </div>
        
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader sortKey="ticket_id" currentSort={sortConfig} onSort={handleSort}>
                  Ticket ID
                </SortableHeader>
                <SortableHeader sortKey="summary" currentSort={sortConfig} onSort={handleSort}>
                  Summary
                </SortableHeader>
                <TableHead>Description</TableHead>
                <SortableHeader sortKey="final_cti.category" currentSort={sortConfig} onSort={handleSort}>
                  Category
                </SortableHeader>
                <SortableHeader sortKey="final_cti.type" currentSort={sortConfig} onSort={handleSort}>
                  Type
                </SortableHeader>
                <TableHead>Item</TableHead>
                <TableHead>Resolver Group</TableHead>
                <TableHead>Request Type</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Justification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  onClick={() => onTicketClick(ticket.id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell className="font-medium text-blue-600">
                    {ticket.ticket_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="max-w-xs truncate">{ticket.summary}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs line-clamp-2 text-sm text-gray-500">
                      {ticket.description}
                    </div>
                  </TableCell>
                  <TableCell>{ticket.final_cti?.category || '-'}</TableCell>
                  <TableCell>{ticket.final_cti?.type || '-'}</TableCell>
                  <TableCell>{ticket.final_cti?.item || '-'}</TableCell>
                  <TableCell>{ticket.final_cti?.resolver_group || '-'}</TableCell>
                  <TableCell>{ticket.final_cti?.request_type || '-'}</TableCell>
                  <TableCell>{ticket.final_cti?.sla || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="min-w-[200px]">
                      <JustificationCell justification={ticket.prediction_justification} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t">
            <Pagination 
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketList;