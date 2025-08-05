import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle, X, Loader2 } from 'lucide-react';
import APIService from '../../services/api';

const SmartRecommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingAction, setApplyingAction] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await APIService.getCTIRecommendations();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to load recommendations. Please try again later.');
      alert('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (recommendationId, action, recommendationTitle) => {
    setApplyingAction(`${recommendationId}-${action}`);
    try {
      await APIService.applyCTIRecommendation(recommendationId, action);
      alert(`Successfully applied ${recommendationTitle || 'recommendation'}`);
      fetchRecommendations();
    } catch (error) {
      console.error('Error applying recommendation:', error);
      const errorMessage = error.response?.data?.message || 'Failed to apply recommendation';
      alert(errorMessage);
    } finally {
      setApplyingAction(null);
    }
  };

  const getRecommendationIcon = (type) => {
    const icons = {
      'duplicate': '🔄',
      'orphaned': '🗑️',
      'missing_description': '📝',
      'consolidation': '📊',
      'low_usage': '⚠️'
    };
    return icons[type] || '💡';
  };

  const getRecommendationColor = (type) => {
    const colors = {
      'duplicate': 'border-yellow-200 bg-yellow-50',
      'orphaned': 'border-red-200 bg-red-50',
      'missing_description': 'border-blue-200 bg-blue-50',
      'consolidation': 'border-purple-200 bg-purple-50',
      'low_usage': 'border-orange-200 bg-orange-50'
    };
    return colors[type] || 'border-gray-200 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <X className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchRecommendations}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-600 focus:outline-none"
            >
              Try again <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Brain className="w-5 h-5 mr-2 text-blue-600" />
          Smart CTI Recommendations
        </h3>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Refreshing...
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-4xl mb-2">✅</div>
          <h4 className="font-medium text-green-900">All Good!</h4>
          <p className="text-sm text-green-700">No recommendations at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, i) => {
            const isApplying = applyingAction?.startsWith(`${rec.id}-`);
            return (
              <div key={i} className={`border rounded-lg p-4 ${getRecommendationColor(rec.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-lg mr-2">{getRecommendationIcon(rec.type)}</span>
                      <h4 className="font-medium text-gray-900">{rec.title}</h4>
                      <span className="ml-2 px-2 py-1 bg-white rounded text-xs font-medium text-gray-600">
                        {rec.impact_level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{rec.description}</p>
                    
                    {rec.affected_records && rec.affected_records.length > 0 && (
                      <div className="text-xs text-gray-600 mb-2">
                        <strong>Affected Records:</strong> {rec.affected_records.join(', ')}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      <strong>Potential Impact:</strong> {rec.potential_impact}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 ml-4 min-w-[200px] justify-end">
                    {rec.actions.map((action, j) => {
                      const actionInProgress = applyingAction === `${rec.id}-${action.id}`;
                      return (
                        <button
                          key={j}
                          onClick={() => applyRecommendation(rec.id, action.id, action.label)}
                          disabled={isApplying}
                          className={`px-3 py-1.5 text-xs rounded font-medium transition-colors flex items-center justify-center min-w-[100px] ${
                            action.type === 'primary' 
                              ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                          }`}
                        >
                          {actionInProgress ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                              {action.label}
                            </>
                          ) : (
                            action.label
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => applyRecommendation(rec.id, 'dismiss', 'Dismiss')}
                      disabled={isApplying}
                      className="px-3 py-1.5 text-xs rounded font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                    >
                      {applyingAction === `${rec.id}-dismiss` ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          Dismissing...
                        </>
                      ) : (
                        'Dismiss'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmartRecommendations;
