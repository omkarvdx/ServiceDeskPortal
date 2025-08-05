import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
         LineChart, Line } from 'recharts';
import { TrendingDown, AlertTriangle, Target, Brain, RefreshCw } from 'lucide-react';
import APIService from '../../services/api';

const AIPerformanceDashboard = () => {
  const [performanceData, setPerformanceData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const data = await APIService.getAIPerformanceAnalytics();
      setPerformanceData(data);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading AI performance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Brain className="w-6 h-6 mr-2" />
          AI Performance Analytics
        </h2>
        <button
          onClick={fetchPerformanceData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Analytics
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problematic CTI Records */}
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Most Frequently Corrected CTI Records
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="text-left p-2">CTI Record</th>
                  <th className="text-center p-2">Corrections</th>
                  <th className="text-center p-2">Accuracy</th>
                  <th className="text-center p-2">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.problematic_cti?.map((cti, i) => (
                  <tr key={i} className="border-t border-red-100 hover:bg-red-25">
                    <td className="p-2">
                      <div className="font-medium">{cti.item}</div>
                      <div className="text-gray-500 text-xs">{cti.category}</div>
                    </td>
                    <td className="text-center p-2">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                        {cti.correction_count}
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        cti.accuracy < 0.7 ? 'bg-red-100 text-red-800' : 
                        cti.accuracy < 0.9 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {Math.round(cti.accuracy * 100)}%
                      </span>
                    </td>
                    <td className="text-center p-2 text-gray-600">
                      {(cti.avg_confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            AI Confidence Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={performanceData.confidence_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="confidence_range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {performanceData.low_confidence_count || 0}
              </div>
              <div className="text-gray-600">Low (&lt;50%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {performanceData.medium_confidence_count || 0}
              </div>
              <div className="text-gray-600">Medium (50-80%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {performanceData.high_confidence_count || 0}
              </div>
              <div className="text-gray-600">High (&gt;80%)</div>
            </div>
          </div>
        </div>

        {/* Accuracy Trends */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="w-5 h-5 mr-2" />
            Classification Accuracy Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData.accuracy_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
              <Tooltip formatter={(value) => [`${Math.round(value * 100)}%`, 'Accuracy']} />
              <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2} name="Accuracy" />
              <Line type="monotone" dataKey="avg_confidence" stroke="#3B82F6" strokeWidth={2} name="Confidence" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AIPerformanceDashboard;
