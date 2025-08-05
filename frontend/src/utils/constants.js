// Application constants and configurations
export const USER_ROLES = {
  END_USER: 'end_user',
  SUPPORT_ENGINEER: 'support_engineer',
  ADMIN: 'admin',
};

export const PERMISSIONS = {
  CAN_VIEW_TICKETS: ['support_engineer', 'admin'],
  CAN_CORRECT_CLASSIFICATIONS: ['support_engineer', 'admin'],
  CAN_MANAGE_CTI: ['admin'],
  CAN_ACCESS_QUEUE: ['support_engineer', 'admin'],
  CAN_BULK_OPERATIONS: ['support_engineer', 'admin'],
  CAN_ADMIN_FUNCTIONS: ['admin'],
};

export const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const PRIORITY_LEVELS = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export const STATUS_COLORS = {
  [TICKET_STATUS.OPEN]: 'bg-blue-100 text-blue-800',
  [TICKET_STATUS.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [TICKET_STATUS.RESOLVED]: 'bg-green-100 text-green-800',
  [TICKET_STATUS.CLOSED]: 'bg-gray-100 text-gray-800',
};

export const CLASSIFICATION_STATUS = {
  UNCLASSIFIED: 'unclassified',
  PREDICTED: 'predicted',
  CORRECTED: 'corrected',
};

export const QUEUE_FILTERS = {
  STATUS: {
    ALL: '',
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
    OPEN_UNASSIGNED: 'open_unassigned',
    MY_ASSIGNED: 'my_assigned',
  },
  ASSIGNMENT: {
    ALL: 'all',
    ASSIGNED: 'assigned',
    UNASSIGNED: 'unassigned',
    ME: 'me',
  },
  CLASSIFICATION: {
    ALL: 'all',
    UNCLASSIFIED: 'unclassified',
    LOW_CONFIDENCE: 'low_confidence',
    CORRECTED: 'corrected',
    NEEDS_REVIEW: 'needs_review',
  },
  AGE: {
    ALL: 'all',
    LAST_24H: 'last_24h',
    LAST_WEEK: 'last_week',
    OLDER_THAN_24H: 'older_than_24h',
    OLDER_THAN_WEEK: 'older_than_week',
  },
  PRIORITY: {
    ALL: 'all',
    HIGH: 'high',
  }
};

export const API_ENDPOINTS = {
  LOGIN: '/auth/login/',
  LOGOUT: '/auth/logout/',
  CURRENT_USER: '/auth/user/',
  TICKETS: '/tickets/',
  QUEUE: '/queue/',
  CTI_RECORDS: '/cti/',
};

export const DEMO_ACCOUNTS = [
  { username: 'user1', password: 'user123', role: 'End User' },
  { username: 'support1', password: 'support123', role: 'Support Engineer' },
  { username: 'admin', password: 'admin123', role: 'Administrator' },
];

// Utility functions for queue
export const formatTicketAge = (ageInHours) => {
  if (ageInHours < 1) {
    return `${Math.round(ageInHours * 60)}m`;
  } else if (ageInHours < 24) {
    return `${Math.round(ageInHours)}h`;
  } else {
    return `${Math.round(ageInHours / 24)}d`;
  }
};

export const getClassificationStatusColor = (status) => {
  const colors = {
    [CLASSIFICATION_STATUS.UNCLASSIFIED]: 'bg-gray-100 text-gray-800',
    [CLASSIFICATION_STATUS.PREDICTED]: 'bg-blue-100 text-blue-800',
    [CLASSIFICATION_STATUS.CORRECTED]: 'bg-green-100 text-green-800',
  };
  return colors[status] || colors[CLASSIFICATION_STATUS.UNCLASSIFIED];
};

export const getPriorityColor = (needsAttention, confidence) => {
  if (needsAttention) {
    return 'bg-red-500';
  }
  if (confidence && confidence < 0.5) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
};
