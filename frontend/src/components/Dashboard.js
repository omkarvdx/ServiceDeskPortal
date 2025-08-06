import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, RefreshCw, BarChart3, List, Database, BookOpen, Brain, Upload, FileSpreadsheet, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import APIService from '../services/api';
import Header from './Header';
import TicketList from './TicketList';
import TicketDetailModal from './TicketDetail';
import CreateTicketModal from './CreateTicketModal';
import TicketQueue from './TicketQueue';
import TicketImportModal from './TicketImportModal';
import AdminCTIManagement from './AdminCTIManagement';
import CTIReadOnlyView from './CTIReadOnlyView';
import AIPerformanceDashboard from './admin/AIPerformanceDashboard';
import TrainingExamplesManager from './TrainingExamplesManager';
import AccessDenied from './AccessDenied';
import { USER_ROLES, TICKET_STATUS, PERMISSIONS } from '../utils/constants';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState(() => {
    if (user.role === USER_ROLES.SUPPORT_ENGINEER) {
      return 'queue';
    }
    return 'tickets';
  });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({ classification: '', search: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false
  });

  const exportToExcel = (tickets) => {
    try {
      // Prepare the data for export
      const data = tickets.map(ticket => ({
        'Ticket ID': ticket.ticket_id,
        'Summary': ticket.summary || '',
        'Description': ticket.description || '',
        'Category': ticket.final_cti?.category || '',
        'Type': ticket.final_cti?.type || '',
        'Item': ticket.final_cti?.item || '',
        'Resolver Group': ticket.final_cti?.resolver_group || '',
        'Request Type': ticket.final_cti?.request_type || '',
        'SLA': ticket.final_cti?.sla || '',
        'Justification': ticket.prediction_justification || ''
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Auto-size columns
      const wscols = [
        {wch: 15}, // Ticket ID
        {wch: 50}, // Summary
        {wch: 70}, // Description
        {wch: 20}, // Category
        {wch: 20}, // Type
        {wch: 30}, // Item
        {wch: 25}, // Resolver Group
        {wch: 20}, // Request Type
        {wch: 15}, // SLA
        {wch: 70}  // Justification
      ];
      ws['!cols'] = wscols;
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
      
      // Generate the Excel file
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `tickets_export_${date}.xlsx`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting tickets to Excel. Please try again.');
    }
  };

  const fetchTickets = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      console.log('Fetching tickets with filters:', filters, 'page:', page);
      const response = await APIService.getTickets(filters, page, pagination.pageSize);
      console.log('Received tickets data:', response);
      
      // Update tickets and pagination state
      setTickets(Array.isArray(response.results) ? response.results : []);
      
      setPagination(prev => ({
        ...prev,
        currentPage: page,
        totalItems: response.count || 0,
        totalPages: Math.ceil((response.count || 0) / pagination.pageSize),
        hasNext: !!response.next,
        hasPrevious: !!response.previous
      }));
      
    } catch (error) {
      console.error('Error fetching tickets:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [filters, activeTab, fetchTickets]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Reset to first page when refreshing
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchTickets(1).finally(() => setRefreshing(false));
  }, [fetchTickets]);

  // Update filters and reset to first page
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  const handleTicketImport = async (file) => {
    try {
      setLoading(true);
      
      // First, read the file to validate and process it
      const data = await file.text();
      
      // Parse the CSV with proper options for handling newlines and special characters
      const workbook = XLSX.read(data, {
        type: 'string',
        raw: true,
        cellDates: true,
        cellText: true,
        codepage: 65001, // UTF-8
        defval: ''
      });
      
      // Get the first worksheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convert to JSON and clean the data
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        skipHidden: true
      })
      .filter((row, index) => index > 0 && row.length > 0) // Skip header and empty rows
      .map((row, index) => ({
        summary: row[0] || `Imported Ticket ${index + 1}`,
        description: row[1] || 'No description provided',
        category: row[2] || '',
        type: row[3] || '',
        item: row[4] || '',
        resolver_group: row[5] || '',
        request_type: row[6] || '',
        sla: row[7] || '',
        justification: row[8] || ''
      }));
      
      // Check if record count exceeds 50
      if (jsonData.length > 50) {
        return { 
          success: false, 
          error: 'Maximum 50 records can be imported at a time. Your file contains ' + jsonData.length + ' records.'
        };
      }

      // Prepare form data for API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('maxRecords', '50');
      
      // Process the file through the API
      await APIService.importTicketsCSV(formData);
      await fetchTickets();
      
      return { 
        success: true, 
        message: `Successfully imported ${jsonData.length} records!` 
      };
    } catch (error) {
      console.error('Error importing tickets:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to import tickets. Please check the file format and try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setRefreshing(true);
      console.log('Exporting tickets with filters:', filters);
      await APIService.exportTickets(filters);
    } catch (error) {
      console.error('Error exporting tickets:', error);
      // You might want to show an error toast/notification here
      alert('Failed to export tickets. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleTicketClick = async (ticketId) => {
    try {
      const ticket = await APIService.getTicketDetail(ticketId);
      setSelectedTicket(ticket);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    }
  };

  const handleCreateSuccess = () => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
    setShowCreateModal(false);
  };

  const handleUpdateSuccess = () => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
    setShowDetailModal(false);
    setSelectedTicket(null);
  };

  // handleExportAll is already defined above with API service integration

  const getStatusCounts = () => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === TICKET_STATUS.OPEN).length,
      in_progress: tickets.filter(t => t.status === TICKET_STATUS.IN_PROGRESS).length,
      resolved: tickets.filter(t => t.status === TICKET_STATUS.RESOLVED).length,
      closed: tickets.filter(t => t.status === TICKET_STATUS.CLOSED).length,
    };
  };

  const statusCounts = getStatusCounts();

  const getTabs = () => {
    const tabs = [];

    if (user.role === USER_ROLES.SUPPORT_ENGINEER) {
      tabs.push(
        {
          id: 'queue',
          label: 'Ticket Queue',
          icon: List,
          description: 'Advanced ticket management'
        },
        {
          id: 'tickets',
          label: 'All Tickets',
          icon: BarChart3,
          description: 'Complete ticket overview'
        },
        {
          id: 'cti_view',
          label: 'CTI Records',
          icon: Database,
          description: 'View CTI master data'
        }
      );
    } else if (user.role === USER_ROLES.ADMIN) {
      tabs.push(
        {
          id: 'tickets',
          label: 'All Tickets',
          icon: BarChart3,
          description: 'Complete ticket overview'
        },
        {
          id: 'cti_view',
          label: 'CTI Records',
          icon: Database,
          description: 'View CTI master data'
        },
        {
          id: 'manage_cti',
          label: 'Manage CTI',
          icon: Database,
          description: 'Manage CTI master data',
          adminOnly: true
        }
      );
    } else {
      tabs.push(
        {
          id: 'tickets',
          label: 'All Tickets',
          icon: BarChart3,
          description: 'Complete ticket overview user wise'
        },
        {
          id: 'cti_view',
          label: 'CTI Records',
          icon: Database,
          description: 'View CTI master data'
        }
      );
    }

    return tabs;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'queue':
        return PERMISSIONS.CAN_ACCESS_QUEUE.includes(user.role) ? (
          <TicketQueue user={user} />
        ) : <AccessDenied />;
      case 'cti_view':
        return [USER_ROLES.SUPPORT_ENGINEER, USER_ROLES.ADMIN].includes(user.role) ? (
          <CTIReadOnlyView user={user} />
        ) : <AccessDenied />;

      case 'ai_analytics':
        return user.role === USER_ROLES.ADMIN ? (
          <div className="p-6">
            <AIPerformanceDashboard />
          </div>
        ) : <AccessDenied />;
        
      case 'manage_cti':
        return user.role === USER_ROLES.ADMIN ? (
          <div className="p-6">
            <AdminCTIManagement user={user} />
          </div>
        ) : <AccessDenied />;
      case 'admin':
        return user.role === USER_ROLES.ADMIN ? (
          <AdminCTIManagement user={user} />
        ) : <AccessDenied />;
      case 'training_examples':
        return user.role === USER_ROLES.ADMIN ? (
          <TrainingExamplesManager user={user} />
        ) : <AccessDenied />;
      case 'tickets':
      default:
        return (
          <div className="p-6">
            {/* Dashboard Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {user.role === USER_ROLES.SUPPORT_ENGINEER ? 'All Tickets' : 'My Tickets'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {user.role === USER_ROLES.SUPPORT_ENGINEER
                    ? 'Overview of all support tickets in the system'
                    : 'Track and manage your support requests'}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {(user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.END_USER) && (
                  <>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm"
                      title="Create a single new support ticket"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      New Ticket (Single)
                    </button>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center shadow-sm"
                      title="Import tickets from CSV"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Bulk Import (CSV Max 50)
                    </button>
                    <button
                      onClick={() => exportToExcel(tickets)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center shadow-sm"
                      title="Export to Excel"
                    >
                      <FileDown className="w-5 h-5 mr-2" />
                      Export to Excel
                    </button>
                  </>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors border border-gray-200 disabled:opacity-50"
                  title="Refresh tickets"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Status Overview Cards - Removed as per user request */}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tickets by ID, summary, or description..."
                      value={filters.search}
                      onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && fetchTickets(1)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select
                    value={filters.classification || ''}
                    onChange={(e) => updateFilters({ ...filters, classification: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    <option value="unclassified">Unclassified</option>
                    <option value="corrected">Classified</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tickets List */}
            <TicketList
              tickets={tickets}
              onTicketClick={handleTicketClick}
              userRole={user.role}
              loading={loading}
              pagination={{
                currentPage: pagination.currentPage,
                totalPages: pagination.totalPages,
                totalItems: pagination.totalItems
              }}
              onPageChange={(page) => fetchTickets(page)}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={onLogout} />

      {getTabs().length > 1 && (
        <div className="bg-white border-b border-gray-200 px-6">
          <nav className="flex space-x-8">
            {getTabs().map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="w-4 h-4 mr-2" />
                    <div className="text-left">
                      <div>{tab.label}</div>
                      <div className="text-xs text-gray-500 font-normal">{tab.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {renderTabContent()}

      {/* Modals */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        user={user}
      />

      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onUpdateSuccess={handleUpdateSuccess}
        userRole={user.role}
      />
      
      <TicketImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleTicketImport}
      />
    </div>
  );
};

export default Dashboard;
