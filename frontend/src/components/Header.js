import React from 'react';
import { User, LogOut, Settings, BarChart3 } from 'lucide-react';
import { USER_ROLES } from '../utils/constants';

const Header = ({ user, onLogout, onStatsClick }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ServiceDesk Portal</h1>
            <p className="text-sm text-gray-600">Automated Ticket Classification System</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user.role === USER_ROLES.SUPPORT_ENGINEER && onStatsClick && (
            <button
              onClick={onStatsClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="View Statistics"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-full">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role.replace('_', ' ')} {user.department && `• ${user.department}`}
              </p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
