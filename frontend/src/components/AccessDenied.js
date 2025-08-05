import React from 'react';
import { AlertCircle } from 'lucide-react';

const AccessDenied = () => (
  <div className="p-6">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
      <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
      <h3 className="text-lg font-semibold text-red-900">Access Denied</h3>
      <p className="text-red-700">You do not have permission to view this page.</p>
    </div>
  </div>
);

export default AccessDenied;
