import React from 'react';
import PropTypes from 'prop-types';
import { HelpCircle } from 'lucide-react';

const getColorClass = (value) => {
  if (value >= 0.8) return 'bg-green-500';
  if (value >= 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getLabel = (value) => {
  if (value >= 0.8) return 'High';
  if (value >= 0.6) return 'Medium';
  return 'Low';
};

const getTextColor = (value) => {
  if (value >= 0.8) return 'text-green-700';
  if (value >= 0.6) return 'text-yellow-700';
  return 'text-red-700';
};

const AIConfidenceIndicator = ({ confidence, showLabel = true, size = 'medium' }) => {
  const barHeight = size === 'small' ? 'h-1' : size === 'large' ? 'h-3' : 'h-2';
  const percentage = Math.round((confidence || 0) * 100);
  return (
    <div className="flex items-center space-x-2" title="AI prediction confidence">
      <div className={`flex-1 bg-gray-200 rounded-full ${barHeight}`}>
        <div
          className={`${barHeight} rounded-full transition-all duration-500 ${getColorClass(confidence)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${getTextColor(confidence)}`}>{getLabel(confidence)}</span>
      )}
      <HelpCircle className="w-3 h-3 text-gray-400" />
    </div>
  );
};

AIConfidenceIndicator.propTypes = {
  confidence: PropTypes.number.isRequired,
  showLabel: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large'])
};

export default AIConfidenceIndicator;
