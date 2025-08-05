import React, { useState, useEffect } from 'react';
import {
  Database,
  Zap,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  TrendingDown
} from 'lucide-react';

const EnhancedCTIStatsWidget = ({ stats, onStatClick }) => {
  const [trends, setTrends] = useState({});

  useEffect(() => {
    // Fetch trend data (add this endpoint later)
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      // This endpoint can be added later - for now use mock data
      const mockTrends = {
        previous_total_records: stats.total_records - 5,
        previous_has_embeddings: stats.has_embeddings - 3,
        previous_used_records: stats.used_records - 2
      };
      setTrends(mockTrends);
    } catch (error) {
      console.error('Error fetching trends:', error);
    }
  };

  const getTrendIndicator = (current, previous) => {
    if (!previous) return null;

    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;

    return (
      <div className={`flex items-center text-xs ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? (
          <TrendingUp className="w-3 h-3 mr-1" />
        ) : (
          <TrendingDown className="w-3 h-3 mr-1" />
        )}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  const statCards = [
    {
      title: 'Total Records',
      value: stats.total_records || 0,
      icon: Database,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      hoverColor: 'hover:bg-blue-100',
      borderColor: 'border-blue-200',
      trend: getTrendIndicator(stats.total_records, trends.previous_total_records),
      subtitle: `${stats.missing_embeddings || 0} need embeddings`,
      onClick: () => onStatClick?.('total')
    },
    {
      title: 'Has Embeddings',
      value: stats.has_embeddings || 0,
      icon: Zap,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      hoverColor: 'hover:bg-green-100',
      borderColor: 'border-green-200',
      trend: getTrendIndicator(stats.has_embeddings, trends.previous_has_embeddings),
      subtitle: `${stats.embedding_coverage || 0}% coverage`,
      onClick: () => onStatClick?.('has_embeddings')
    },
    {
      title: 'Missing Embeddings',
      value: stats.missing_embeddings || 0,
      icon: AlertCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      hoverColor: 'hover:bg-red-100',
      borderColor: 'border-red-200',
      subtitle: 'Need attention',
      onClick: () => onStatClick?.('missing_embeddings')
    },
    {
      title: 'Used Records',
      value: stats.used_records || 0,
      icon: CheckCircle,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      hoverColor: 'hover:bg-indigo-100',
      borderColor: 'border-indigo-200',
      trend: getTrendIndicator(stats.used_records, trends.previous_used_records),
      subtitle: `${stats.usage_rate || 0}% usage rate`,
      onClick: () => onStatClick?.('used')
    },
    {
      title: 'Usage Rate',
      value: `${stats.usage_rate || 0}%`,
      icon: TrendingUp,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      hoverColor: 'hover:bg-yellow-100',
      borderColor: 'border-yellow-200',
      subtitle: 'In active use',
      onClick: () => onStatClick?.('usage_rate')
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`${stat.bgColor} ${stat.borderColor} ${stat.hoverColor} rounded-lg p-4 border transition-all duration-200 ${
              stat.onClick ? 'cursor-pointer transform hover:scale-105 hover:shadow-md' : ''
            }`}
            onClick={stat.onClick}
            title={stat.onClick ? `Click to filter by ${stat.title.toLowerCase()}` : ''}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              {stat.trend}
            </div>
            <div className={`text-2xl font-bold ${stat.textColor} mb-1`}>
              {stat.value}
            </div>
            <div className="text-sm font-medium text-gray-600 mb-1">
              {stat.title}
            </div>
            <div className="text-xs text-gray-500">
              {stat.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EnhancedCTIStatsWidget;
