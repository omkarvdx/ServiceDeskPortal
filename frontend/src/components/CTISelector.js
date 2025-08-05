import React, { useState, useEffect } from 'react';
import { Search, Tag } from 'lucide-react';
import APIService from '../services/api';

const CTISelector = ({ value, onChange, disabled = false, showSearch = false }) => {
  const [ctiRecords, setCtiRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCTIRecords();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = ctiRecords.filter(cti =>
        cti.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cti.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cti.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cti.resolver_group.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRecords(filtered);
    } else {
      setFilteredRecords(ctiRecords);
    }
  }, [searchTerm, ctiRecords]);

  const fetchCTIRecords = async () => {
    try {
      setLoading(true);
      const records = await APIService.getCTIRecordsReadOnly();
      setCtiRecords(records);
      setFilteredRecords(records);
    } catch (error) {
      console.error('Error fetching CTI records:', error);
      setError('Failed to load CTI records');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (selectedId) => {
    const numericId = selectedId ? parseInt(selectedId) : null;
    onChange(numericId);
  };

  if (loading) {
    return (
      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-gray-500">Loading CTI records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search CTI records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={disabled}
          />
        </div>
      )}
      
      <select
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">Select CTI Record...</option>
        {filteredRecords.map((cti) => (
          <option key={cti.id} value={cti.id}>
            {cti.bu_number} - {cti.category} → {cti.type} → {cti.item}
          </option>
        ))}
      </select>
      
      {value && (
        <div className="text-xs text-gray-600">
          {(() => {
            const selected = ctiRecords.find(cti => cti.id === value);
            return selected ? (
              <div className="bg-gray-50 p-2 rounded border space-y-1">
                <div className="flex items-center">
                  <Tag className="w-3 h-3 mr-1" />
                  <span className="font-medium">Selected: {selected.resolver_group}</span>
                </div>
                <div className="text-gray-500">
                  BU: {selected.bu_number}
                  {selected.bu_description && (
                    <span className="ml-1">- {selected.bu_description}</span>
                  )}
                  {' | SLA: '}{selected.sla} | Type: {selected.request_type}
                </div>

                {selected.service_description && (
                  <div className="text-gray-400 text-justify">
                    {selected.service_description}
                  </div>
                )}
                {selected.resolver_group_description && (
                  <div className="text-gray-400 text-justify">
                    {selected.resolver_group_description}
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
};

export default CTISelector;
