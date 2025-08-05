import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit3, 
  Save, 
  Tag, 
  CheckCircle, 
  ArrowRight,
  Bot,
  UserCheck,
  AlertTriangle,
  Settings,
  Clock,
  Calendar,
  FileText
} from 'lucide-react';
import APIService from '../services/api';
import CTISelector from './CTISelector';
import { USER_ROLES, TICKET_STATUS } from '../utils/constants';
import AIConfidenceIndicator from './AIConfidenceIndicator';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    [TICKET_STATUS.OPEN]: { color: 'bg-blue-100 text-blue-800', icon: Clock },
    [TICKET_STATUS.IN_PROGRESS]: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
    [TICKET_STATUS.RESOLVED]: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    [TICKET_STATUS.CLOSED]: { color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  };

  const config = statusConfig[status] || statusConfig[TICKET_STATUS.OPEN];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
};

// End user specific status widget shown at top of ticket details
const EndUserStatusWidget = ({ ticket }) => {
  const getStatusMessage = () => {
    switch (ticket.status) {
      case 'open':
        return {
          icon: Clock,
          color: 'blue',
          title: 'Ticket Received',
          message: 'Your ticket has been received and is being reviewed by our support team.'
        };
      case 'in_progress':
        return {
          icon: Settings,
          color: 'yellow',
          title: 'Being Worked On',
          message: ticket.assigned_to
            ? `${ticket.assigned_to.first_name} is working on your ticket.`
            : 'Our support team is actively working on your ticket.'
        };
      case 'resolved':
        return {
          icon: CheckCircle,
          color: 'green',
          title: 'Resolved',
          message: 'Your ticket has been resolved. Please let us know if you need further assistance.'
        };
      case 'closed':
        return {
          icon: CheckCircle,
          color: 'gray',
          title: 'Closed',
          message: 'This ticket has been closed. You can create a new ticket if you need additional help.'
        };
      default:
        return null;
    }
  };

  const status = getStatusMessage();
  if (!status) return null;

  const Icon = status.icon;

  return (
    <div className={`bg-${status.color}-50 border border-${status.color}-200 rounded-lg p-4`}>
      <div className="flex items-center mb-2">
        <Icon className={`w-5 h-5 mr-2 text-${status.color}-600`} />
        <h4 className={`font-semibold text-${status.color}-900`}>{status.title}</h4>
      </div>
      <p className={`text-sm text-${status.color}-800`}>{status.message}</p>
    </div>
  );
};

// Additional contextual help shown to end users
const EndUserHelpText = () => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
    <h5 className="text-sm font-medium text-gray-900 mb-2">What happens next?</h5>
    <ul className="text-xs text-gray-700 space-y-1">
      <li>• Your ticket has been automatically assigned to the right support team</li>
      <li>• You'll receive email updates when there are changes to your ticket</li>
      <li>• Our team will contact you if they need additional information</li>
      <li>• Average response time is 2-4 hours during business hours</li>
    </ul>
  </div>
);

const TicketDetailModal = ({ ticket, isOpen, onClose, onUpdate, userRole }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    corrected_cti_id: null,
    correction_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ticket) {
      setFormData({
        status: ticket.status,
        corrected_cti_id: ticket.corrected_cti?.id || ticket.predicted_cti?.id || null,
        correction_notes: ''
      });
    }
  }, [ticket]);

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      await APIService.updateTicket(ticket.id, formData);
      onUpdate();
      setEditing(false);
      setFormData({ ...formData, correction_notes: '' });
    } catch (error) {
      setError(error.message || 'Failed to update ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEditing(false);
    setError('');
    setFormData({ ...formData, correction_notes: '' });
    onClose();
  };

  if (!isOpen || !ticket) return null;

  const finalCti = ticket.corrected_cti || ticket.predicted_cti;
  const wasCorrected = ticket.corrected_cti && ticket.predicted_cti && 
                      ticket.corrected_cti.id !== ticket.predicted_cti.id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto fade-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{ticket.ticket_id}</h2>
              <p className="text-gray-600 mt-1">{ticket.summary}</p>
            </div>
            <div className="flex items-center space-x-2">
              {userRole === USER_ROLES.SUPPORT_ENGINEER && (
                <button
                  onClick={() => setEditing(!editing)}
                  disabled={loading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title={editing ? "Cancel editing" : "Edit ticket"}
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {userRole === USER_ROLES.END_USER && <EndUserStatusWidget ticket={ticket} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Ticket Details */}
            <div className="space-y-6">

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Description</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - AI Classification */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Tag className="w-5 h-5 mr-2" />
                  AI Classification
                </h3>

                {userRole === USER_ROLES.END_USER && ticket.final_cti && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Ticket Assignment
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-green-700">Category:</span>
                        <span className="text-green-900 ml-2">{ticket.final_cti.category}</span>
                      </div>
                      <div>
                        <span className="font-medium text-green-700">Support Team:</span>
                        <span className="text-green-900 ml-2">{ticket.final_cti.resolver_group}</span>
                      </div>
                      <div>
                        <span className="font-medium text-green-700">Priority:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                          ticket.final_cti.sla === 'P1' ? 'bg-red-100 text-red-800' :
                          ticket.final_cti.sla === 'P2' ? 'bg-orange-100 text-orange-800' :
                          ticket.final_cti.sla === 'P3' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {ticket.final_cti.sla === 'P1' ? 'Critical' :
                           ticket.final_cti.sla === 'P2' ? 'High' :
                           ticket.final_cti.sla === 'P3' ? 'Medium' : 'Low'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Prediction Section */}
                {ticket.predicted_cti && [USER_ROLES.SUPPORT_ENGINEER, USER_ROLES.ADMIN].includes(userRole) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-900 flex items-center">
                        <Bot className="w-4 h-4 mr-2" />
                        AI Prediction
                      </h4>
                      <AIConfidenceIndicator confidence={ticket.prediction_confidence} size="small" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-blue-700">BU:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.bu_number}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Category:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.category}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Type:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.type}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-blue-700">Item:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.item}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Resolver Group:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.resolver_group}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Request Type:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.request_type}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">SLA:</span>
                        <p className="text-blue-900 mt-1">{ticket.predicted_cti.sla}</p>
                      </div>
                    </div>
                    
                    {ticket.prediction_justification && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <span className="text-xs font-medium text-blue-700">AI Reasoning:</span>
                        <p className="text-xs text-blue-900 mt-1 italic">
                          {ticket.prediction_justification}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Classification Correction Section */}
                {userRole === USER_ROLES.SUPPORT_ENGINEER && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
                      <UserCheck className="w-4 h-4 mr-2" />
                      {wasCorrected ? 'Corrected Classification' : 'Current Classification'}
                    </h4>
                    
                    {editing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-green-700 mb-2">
                            Select Correct CTI Record:
                          </label>
                          <CTISelector
                            value={formData.corrected_cti_id}
                            onChange={(value) => setFormData({ ...formData, corrected_cti_id: value })}
                            showSearch={true}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-green-700 mb-2">
                            Correction Notes:
                          </label>
                          <textarea
                            value={formData.correction_notes}
                            onChange={(e) => setFormData({ ...formData, correction_notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 text-xs border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Why was this correction made? (optional)"
                          />
                        </div>
                      </div>
                    ) : finalCti ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="font-medium text-green-700">BU:</span>
                          <p className="text-green-900 mt-1">{finalCti.bu_number}</p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">Category:</span>
                          <p className="text-green-900 mt-1">{finalCti.category}</p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">Type:</span>
                          <p className="text-green-900 mt-1">{finalCti.type}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-green-700">Item:</span>
                          <p className="text-green-900 mt-1">{finalCti.item}</p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">Resolver Group:</span>
                          <p className="text-green-900 mt-1">{finalCti.resolver_group}</p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">Request Type:</span>
                          <p className="text-green-900 mt-1">{finalCti.request_type}</p>
                        </div>
                        <div>
                          <span className="font-medium text-green-700">SLA:</span>
                          <p className="text-green-900 mt-1">{finalCti.sla}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-green-700">No classification available</p>
                    )}

                    {/* Few-Shot Examples Section */}
                    {userRole === USER_ROLES.SUPPORT_ENGINEER && finalCti && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
                        <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Similar Examples
                        </h4>
                        <div className="text-xs text-purple-800">
                          <p>Based on {finalCti.example_count || 0} real ticket examples</p>
                          {finalCti.example_count >= 3 ? (
                            <p className="text-green-700">✓ Well-documented category</p>
                          ) : (
                            <p className="text-amber-700">⚠ Limited examples</p>
                          )}
                        </div>
                      </div>
                    )}

                    {wasCorrected && !editing && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="flex items-center text-xs text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          <span>
                            Corrected by {ticket.corrected_by?.first_name} {ticket.corrected_by?.last_name}
                            {ticket.corrected_at && (
                              <span className="ml-1">
                                on {new Date(ticket.corrected_at).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Classification Change Indicator */}
                {wasCorrected && !editing && (
                  <div className="flex items-center justify-center py-3">
                    <div className="flex items-center text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-full">
                      <span className="text-blue-600 font-medium">AI Prediction</span>
                      <ArrowRight className="w-3 h-3 mx-2" />
                      <span className="text-green-600 font-medium">Manual Correction</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {userRole === USER_ROLES.END_USER && <EndUserHelpText />}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailModal;
