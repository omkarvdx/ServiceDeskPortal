import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckSquare,
  UserPlus,
  Edit,
  Eye,
  UserCheck,
  CheckCircle
} from 'lucide-react';
import APIService from '../services/api';
import TicketDetailModal from './TicketDetail';
import BulkActionsModal from './BulkActionsModal';
import QueueStatsWidget from './QueueStatsWidget';
import { TICKET_STATUS, STATUS_COLORS } from '../utils/constants';
import AIConfidenceIndicator from './AIConfidenceIndicator';

const PRIORITY_FILTERS = {
  urgent: {
    label: 'Urgent',
    count: 0,
    color: 'red',
    filters: { status: 'open', age: 'older_than_24h' }
  },
  lowConfidence: {
    label: 'Low Confidence',
    count: 0,
    color: 'yellow',
    filters: { classification: 'low_confidence' }
  },
  aging: {
    label: 'Aging',
    count: 0,
    color: 'orange',
    filters: { age: 'older_than_week' }
  },
  myTickets: {
    label: 'My Tickets',
    count: 0,
    color: 'blue',
    filters: { assignment: 'me' }
  }
};

const FILTER_PRESETS = {
  needsAttention: 'Needs Attention',
  unassigned: 'Unassigned',
  highPriority: 'High Priority',
  recentlyCreated: 'Recently Created'
};

const QUICK_ACTIONS = {
  assignToMe: async (ticketId, userId) => {
    await APIService.updateTicket(ticketId, { assigned_to: userId });
  },
  quickResolve: async (ticketId) => {
    await APIService.updateTicket(ticketId, { status: TICKET_STATUS.RESOLVED });
  },
  correctAI: async (ticketId) => {
    // opening modal handled separately
    return Promise.resolve();
  }
};

const TicketQueue = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    assignment: '',
    classification: '',
    age: '',
    priority: '',
    category: '',
    search: '',
    sort: '-created_at'
  });
  const [filterOptions, setFilterOptions] = useState({});
  const [stats, setStats] = useState({});
  const defaultFilters = {
    status: '',
    assignment: '',
    classification: '',
    age: '',
    priority: '',
    category: '',
    search: '',
    sort: '-created_at'
  };
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('queuePresets')) || {};
    } catch {
      return {};
    }
  });
  const [activePreset, setActivePreset] = useState('');
  const priorityCounts = useMemo(() => ({
    urgent: tickets.filter(t => t.status === 'open' && t.age_in_hours > 24).length,
    lowConfidence: tickets.filter(t => t.prediction_confidence && t.prediction_confidence < 0.6).length,
    aging: tickets.filter(t => t.age_in_hours > 24 * 7).length,
    myTickets: tickets.filter(t => t.assigned_to && t.assigned_to.id === user.id).length,
  }), [tickets, user.id]);

  const hasAdvancedFilters = useMemo(() => {
    const keys = ['status', 'assignment', 'classification', 'age', 'priority', 'category'];
    return keys.some(k => filters[k] && filters[k] !== defaultFilters[k]);
  }, [filters]);

  useEffect(() => {
    try {
      localStorage.setItem('queuePresets', JSON.stringify(savedPresets));
    } catch {
      // ignore write errors
    }
  }, [savedPresets]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchTickets();
    fetchFilterOptions();
    fetchStats();
  }, [filters]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await APIService.request('/queue/', { method: 'GET' });
      setTickets(data.results || data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const options = await APIService.request('/queue/filters/');
      setFilterOptions(options);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await APIService.request('/queue/stats/');
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTickets(), fetchStats()]);
    setRefreshing(false);
  };

  const handleTicketSelect = (ticketId, checked) => {
    const newSelected = new Set(selectedTickets);
    if (checked) {
      newSelected.add(ticketId);
    } else {
      newSelected.delete(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedTickets(new Set(tickets.map(t => t.id)));
    } else {
      setSelectedTickets(new Set());
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

  const handleBulkAction = async (action, data) => {
    try {
      const ticketIds = Array.from(selectedTickets);
      await APIService.request('/queue/bulk-update/', {
        method: 'POST',
        body: JSON.stringify({
          ticket_ids: ticketIds,
          action,
          ...data
        })
      });
      
      setSelectedTickets(new Set());
      await fetchTickets();
      await fetchStats();
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const handleAutoAssign = async () => {
    try {
      const result = await APIService.request('/queue/auto-assign/', {
        method: 'POST'
      });
      
      alert(`Successfully auto-assigned ${result.assigned_count} tickets`);
      await fetchTickets();
      await fetchStats();
    } catch (error) {
      console.error('Error auto-assigning tickets:', error);
    }
  };

  const applyPriorityFilter = (key) => {
    const config = PRIORITY_FILTERS[key];
    if (!config) return;
    setFilters(prev => ({ ...prev, ...config.filters }));
    setActivePreset(key);
  };

  const saveCurrentPreset = () => {
    const name = prompt('Preset name?');
    if (!name) return;
    const newPresets = { ...savedPresets, [name]: filters };
    setSavedPresets(newPresets);
  };

  const loadPreset = (name) => {
    const preset = savedPresets[name];
    if (preset) {
      setFilters({ ...filters, ...preset });
    }
  };

  const handleQuickAction = async (action, ticketId) => {
    setActionLoading(ticketId);
    try {
      if (action === 'correctAI') {
        await handleTicketClick(ticketId);
      } else {
        await QUICK_ACTIONS[action](ticketId, user.id);
        await fetchTickets();
        await fetchStats();
      }
    } catch (error) {
      console.error('Quick action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      [TICKET_STATUS.OPEN]: { icon: Clock, label: 'Open' },
      [TICKET_STATUS.IN_PROGRESS]: { icon: AlertTriangle, label: 'In Progress' },
      [TICKET_STATUS.RESOLVED]: { icon: CheckSquare, label: 'Resolved' },
      [TICKET_STATUS.CLOSED]: { icon: CheckSquare, label: 'Closed' },
    };

    const config = statusConfig[status] || statusConfig[TICKET_STATUS.OPEN];
    const Icon = config.icon;
    const colorClass = STATUS_COLORS[status] || STATUS_COLORS[TICKET_STATUS.OPEN];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getPriorityIndicator = (ticket) => {
    if (ticket.needs_attention) {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full" title="Needs Attention" />
      );
    }
    if (ticket.prediction_confidence && ticket.prediction_confidence < 0.5) {
      return (
        <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Low Confidence" />
      );
    }
    return null;
  };

  const getClassificationBadge = (ticket) => {
    if (ticket.classification_status === 'corrected') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          Corrected
        </span>
      );
    }
    if (ticket.classification_status === 'predicted') {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            AI Prediction
          </span>
          <AIConfidenceIndicator confidence={ticket.prediction_confidence} size="small" />
        </div>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
        Unclassified
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Queue</h1>
          <p className="text-gray-600">Advanced ticket management and classification</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAutoAssign}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Auto Assign
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Widget */}
      <QueueStatsWidget stats={stats} />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          {Object.entries(PRIORITY_FILTERS).map(([key, cfg]) => (
            <button
              key={key}
              className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                activePreset === key
                  ? `bg-${cfg.color}-100 text-${cfg.color}-800 border border-${cfg.color}-200`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => applyPriorityFilter(key)}
            >
              <div className={`w-2 h-2 rounded-full bg-${cfg.color}-500 mr-2`} />
              {cfg.label} ({priorityCounts[key] || 0})
            </button>
          ))}
          <select
            className="ml-auto text-sm border border-gray-300 rounded p-1"
            onChange={(e) => loadPreset(e.target.value)}
            value=""
          >
            <option value="">Load Preset</option>
            {Object.keys(savedPresets).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button
            onClick={saveCurrentPreset}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
          >
            Save Preset
          </button>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Advanced Filters {hasAdvancedFilters && '(Active)'}
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {filterOptions.statuses?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assignment</label>
              <select
                value={filters.assignment}
                onChange={(e) => setFilters({ ...filters, assignment: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {filterOptions.assignments?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Classification</label>
              <select
                value={filters.classification}
                onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {filterOptions.classifications?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
              <select
                value={filters.age}
                onChange={(e) => setFilters({ ...filters, age: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {filterOptions.ages?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions.categories?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {filterOptions.sort_options?.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </details>

        <div className="flex items-center space-x-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets, summaries, or users..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {selectedTickets.size > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              Bulk Actions ({selectedTickets.size})
            </button>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading queue...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-500">No tickets match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTickets.size === tickets.length && tickets.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Summary
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedTickets.has(ticket.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTickets.has(ticket.id)}
                        onChange={(e) => handleTicketSelect(ticket.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center">
                        {getPriorityIndicator(ticket)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleTicketClick(ticket.id)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {ticket.ticket_id}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 font-medium truncate max-w-xs">
                        {ticket.summary}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        By: {ticket.created_by.first_name} {ticket.created_by.last_name}
                        {ticket.created_by.department && ` • ${ticket.created_by.department}`}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="px-4 py-4">
                      {ticket.assigned_to ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {ticket.assigned_to.first_name} {ticket.assigned_to.last_name}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {ticket.assigned_to.username}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {getClassificationBadge(ticket)}
                        {ticket.final_cti && (
                          <div className="text-xs text-gray-600 truncate max-w-xs">
                            {ticket.final_cti.category} → {ticket.final_cti.item}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {ticket.age_in_hours < 1 
                          ? `${Math.round(ticket.age_in_hours * 60)}m`
                          : ticket.age_in_hours < 24
                          ? `${Math.round(ticket.age_in_hours)}h`
                          : `${Math.round(ticket.age_in_hours / 24)}d`
                        }
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleQuickAction('assignToMe', ticket.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Assign to Me"
                          disabled={actionLoading === ticket.id}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction('correctAI', ticket.id)}
                          className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="Correct AI Classification"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction('quickResolve', ticket.id)}
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Mark as Resolved"
                          disabled={actionLoading === ticket.id}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTicketClick(ticket.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <BulkActionsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        selectedCount={selectedTickets.size}
        onAction={handleBulkAction}
        filterOptions={filterOptions}
      />

      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedTicket(null);
        }}
        onUpdate={async () => {
          await fetchTickets();
          await fetchStats();
          setShowDetailModal(false);
          setSelectedTicket(null);
        }}
        userRole={user.role}
      />
    </div>
  );
};

export default TicketQueue;
