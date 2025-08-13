// API Service for backend communication
class APIService {
  static baseURL = process.env.REACT_APP_API_URL || 'https://adp.automationedge.com/servicedesk';

  // Get CSRF token from cookie
  static getCSRFToken() {
    // First try to get from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
      return metaToken.getAttribute('content');
    }
    
    // Fall back to cookie
    const cookieMatch = document.cookie.match(/csrftoken=([^;]+)/);
    if (cookieMatch) {
      return cookieMatch[1];
    }
    
    console.warn('CSRF token not found in cookies or meta tags');
    return null;
  }

  // Get session ID from cookie
  static getSessionId() {
    const match = document.cookie.match(/sessionid=([^;]+)/);
    return match ? match[1] : null;
  }

  // Get authentication token from localStorage or sessionStorage
  static getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  static async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    };
    
    // Add authentication token if available
    const authToken = this.getAuthToken();
    if (authToken) {
      headers['Authorization'] = `Token ${authToken}`;
    }
    
    // Add CSRF token for non-GET requests
    if (options.method && options.method !== 'GET') {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    // Configure fetch options
    const config = {
      credentials: 'include', // Include cookies for CSRF
      headers,
      ...options,
    };

    // Remove content-type header when sending FormData
    if (config.body && config.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      
      // For 204 No Content responses, return success
      if (response.status === 204) {
        return { success: true };
      }
      
      // Try to parse JSON, but don't fail if response is empty
      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = null;
      }
      
      if (!response.ok) {
        const errorMessage = data?.message || data?.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      return data || { success: true };
      
    } catch (error) {
      console.error('API Request failed:', { 
        url, 
        error: error.message || 'Unknown error'
      });
      
      throw error;
    }
  }

  // Fetch CSRF token from backend explicitly
  static async fetchCSRFToken() {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/csrf/`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        return data.csrfToken;
      }
    } catch (error) {
      console.log('Could not fetch CSRF token:', error);
    }
    return null;
  }

  // Authentication methods
  static async login(credentials) {
    const response = await fetch(`${this.baseURL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    
    // Store the auth token if received
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }
    
    // Store user data if needed
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  }

  static async logout() {
    try {
      // Try to call the server-side logout
      await fetch(`${this.baseURL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': this.getCSRFToken() || '',
        },
      });
    } catch (error) {
      console.error('Logout API call failed, proceeding with client-side cleanup', error);
    } finally {
      // Always clear client-side auth state
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      sessionStorage.clear();
      
      // Clear cookies by setting expiration to past date
      document.cookie = 'sessionid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = 'csrftoken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
    
    return { success: true };
  }

  static async getCurrentUser() {
    return this.request('/api/auth/user/');
  }

  // Ticket methods
  /**
   * Delete a ticket by ID
   * @param {number} id - The ID of the ticket to delete
   * @returns {Promise<Object>} Response from the server
   * @description Deletes a ticket. Only admins can delete any ticket, regular users can only delete their own tickets.
   */
  static async deleteTicket(id) {
    return this.request(`/api/tickets/${id}/delete/`, {
      method: 'DELETE',
    });
  }

  /**
   * Fetches tickets with pagination support
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
   */
  /**
   * Fetches tickets with pagination support
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
   */
  static async getTickets(filters = {}, page = 1, pageSize = 10) {
    console.log('Fetching tickets with filters:', JSON.stringify(filters, null, 2), 'page:', page);
    const params = new URLSearchParams();
    
    // Add pagination parameters
    params.append('page', page);
    params.append('page_size', pageSize);
    
    // Add filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    try {
      const response = await this.request(`/api/tickets/?${params.toString()}`);
      
      // Handle both paginated and non-paginated responses
      const paginatedResponse = {
        count: response.count || response.length || 0,
        next: response.next || null,
        previous: response.previous || null,
        results: Array.isArray(response) ? response : (response.results || [])
      };
      
      console.log('API Response received:', {
        status: 'success',
        count: paginatedResponse.count,
        page: page,
        pageSize: pageSize,
        hasNext: !!paginatedResponse.next,
        hasPrevious: !!paginatedResponse.previous
      });
      
      return paginatedResponse;
    } catch (error) {
      console.error('Error in getTickets:', {
        message: error.message,
        response: error.response,
        config: error.config
      });
      throw error;
    }
  }

  // Export all tickets to Excel
  static async exportTickets() {
    const url = `${this.baseURL}/api/tickets/export/`;
    console.log('Exporting all tickets to Excel');
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-CSRFToken': this.getCSRFToken(),
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Export error response:', error);
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'tickets_export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch != null && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
      return { success: true, filename };
    } catch (error) {
      console.error('Error exporting tickets:', {
        message: error.message,
        response: error.response,
        config: error.config
      });
      throw error;
    }
  }

  // Import tickets from CSV or Excel
  static async importTicketsFile(formData) {
    console.log('Sending import request to /api/tickets/bulk-upload/');
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }
    
    try {
      const response = await this.request('/api/tickets/bulk-upload/', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with the correct boundary
        headers: {
          'X-CSRFToken': this.getCSRFToken(),
        },
      });
      console.log('Import response:', response);
      return response;
    } catch (error) {
      console.error('Import request failed:', error);
      throw error;
    }
  }

  static async createTicket(ticketData) {
    return this.request('/api/tickets/create/', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  static async getTicketDetail(id) {
    return this.request(`/api/tickets/${id}/`);
  }

  static async updateTicket(id, data) {
    return this.request(`/api/tickets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Fetches CTI Records with pagination and filtering support
   * @param {Object} params - Filter and pagination parameters
   * @param {number} [params.page=1] - Page number (1-based)
   * @param {number} [params.page_size=10] - Number of items per page
   * @param {string} [params.search] - Search term for category and resolver_group
   * @param {string} [params.ordering] - Field to order by (prefix with - for descending)
   * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
   */
  static async getCTIRecords(params = {}) {
    const { page = 1, page_size = 10, ...filters } = params;
    const queryParams = new URLSearchParams({
      page,
      page_size,
      ...filters
    });
    
    const response = await this.request(`/api/admin/cti-records/?${queryParams.toString()}`);
    
    // Ensure consistent response format
    return {
      count: response.count || 0,
      next: response.next || null,
      previous: response.previous || null,
      results: Array.isArray(response.results) ? response.results : (Array.isArray(response) ? response : [])
    };
  }

  /**
   * Fetches read-only CTI Records with pagination and filtering support
   * @param {Object} params - Filter and pagination parameters
   * @param {number} [params.page=1] - Page number (1-based)
   * @param {number} [params.page_size=10] - Number of items per page
   * @param {string} [params.search] - Search term for category and resolver_group
   * @param {string} [params.ordering] - Field to order by (prefix with - for descending)
   * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
   */
  static async getCTIRecordsReadOnly(params = {}) {
    const { page = 1, page_size = 10, ...filters } = params;
    const queryParams = new URLSearchParams({
      page,
      page_size,
      ...filters
    });
    
    const response = await this.request(`/api/cti/?${queryParams.toString()}`);

    
    // Ensure consistent response format
    return {
      count: response.count || 0,
      next: response.next || null,
      previous: response.previous || null,
      results: Array.isArray(response.results) ? response.results : (Array.isArray(response) ? response : [])
    };
  }

  static async getCTIExamples(ctiId) {
    return this.request(`/api/cti/${ctiId}/examples/`);
  }

  // Admin methods
  static async precomputeEmbeddings() {
    return this.request('/api/admin/precompute-embeddings/', {
      method: 'POST',
    });
  }

  static async getClassificationStats() {
    return this.request('/api/admin/stats/');
  }

  // Admin CTI Management methods
  static async getAdminCTIRecords(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/cti/?${queryString}`);
  }

  static async createCTIRecord(data) {
    return this.request('/api/cti/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateCTIRecord(id, data) {
    return this.request(`/api/cti/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteCTIRecord(id) {
    return this.request(`/api/cti/${id}/`, {
      method: 'DELETE',
    });
  }

  static async regenerateCTIEmbedding(id) {
    return this.request(`/api/admin/cti/${id}/regenerate-embedding/`, {
      method: 'POST',
    });
  }

  static async bulkCTIActions(data) {
    return this.request('/api/admin/cti/bulk-actions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getCTIFilterOptions() {
    return this.request('/api/cti/filter-options/');
  }

  // CTI Recommendations methods
  static async getCTIRecommendations() {
    return this.request('/api/admin/cti-recommendations/');
  }

  static async applyCTIRecommendation(recommendationId, action) {
    return this.request(`/api/admin/cti-recommendations/${recommendationId}/apply/`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  /**
   * Import CTI records from file (CSV or Excel)
   * @param {File} file - The file to import (CSV or Excel)
   * @returns {Promise<Object>} Import result with counts and any errors
   */
  static async importCTIRecords(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Use the new unified import endpoint
    return this.request('/api/admin/cti/import/', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Export CTI records to file (CSV or Excel)
   * @param {string} queryString - The query string with filters and format
   * @returns {Promise<Blob>} The exported file as a Blob
   */
  static async exportCTIRecords(queryString = '') {
    const url = `${this.baseURL}/api/admin/cti/export/${queryString ? `?${queryString}` : ''}`;
    console.log('Exporting CTI records with query:', queryString);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-CSRFToken': this.getCSRFToken(),
          'Accept': 'application/octet-stream',
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Export error response:', error);
        throw new Error(error || `HTTP error! status: ${response.status}`);
      }
      
      // Return the blob directly for the component to handle
      return await response.blob();
      
    } catch (error) {
      console.error('Error exporting CTI records:', error);
      throw error;
    }
  }

  /**
   * Export CTI records to file (CSV or Excel)
   * @param {string} format - 'csv' or 'xlsx'
   * @param {Object} filters - Optional filters to apply to the export
   * @returns {Promise<Blob>} The exported file as a Blob
   */
  static async exportCTIRecordsOld(format = 'csv', filters = {}) {
    // Ensure baseURL ends with a single slash
    const baseUrl = this.baseURL.endsWith('/') ? this.baseURL : `${this.baseURL}/`;
    
    // Build the URL with the correct path that matches the backend
    const url = new URL('api/admin/cti/export', baseUrl);
    
    // Add format parameter
    url.searchParams.append('format', format);
    
    // Add other filters if provided (excluding pagination and ordering)
    const validFilters = ['category', 'type', 'resolver_group', 'request_type', 'sla', 'search'];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (validFilters.includes(key) && value) {
        url.searchParams.append(key, value);
      }
    });
    
    console.log('Export URL:', url.toString()); // Debug log
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Token ${this.getAuthToken()}`,
        'Accept': format === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Export failed');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Export failed');
    }

    return await response.blob();
  }

  // Training Examples
  static async getTrainingExamples(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/training-examples/?${queryString}`);
  }

  static async createTrainingExample(data) {
    return this.request('/api/training-examples/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateTrainingExample(id, data) {
    return this.request(`/api/training-examples/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteTrainingExample(id) {
    return this.request(`/api/training-examples/${id}/`, {
      method: 'DELETE',
    });
  }

  static async getCTITrainingExamples(ctiId) {
    return this.request(`/api/cti/${ctiId}/training-examples/`);
  }

  static async getTrainingStats() {
    return this.request('/api/training-stats/');
  }

  // AI Performance Analytics
  static async getAIPerformanceAnalytics() {
    return this.request('/api/ai-performance-analytics/');
  }

  // Smart Recommendations - Implementation moved to the first declaration

  // CTI Trends (for enhanced stats)
  static async getCTITrends() {
    return this.request('/api/cti-trends/');
  }

  // Table Management - Tickets
  static async getTicketTableData(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/table/tickets/?${queryString}`);
  }

  static async updateTicketTableRow(id, data) {
    return this.request(`/api/table/tickets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  static async bulkUpdateTicketsTable(data) {
    return this.request('/api/table/tickets/bulk_update/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async bulkDeleteTickets(ids) {
    return this.request('/api/table/tickets/bulk_delete/', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  // Table Management - CTI Records
  static async getCTITableData(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/table/cti/?${queryString}`);
  }

  static async updateCTITableRow(id, data) {
    return this.request(`/api/table/cti/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  static async bulkUpdateCTIRecords(data) {
    return this.request('/api/table/cti/bulk_update/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async bulkDeleteCTIRecords(ids) {
    return this.request('/api/table/cti/bulk_delete/', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  // Queue methods
  static async getQueueTickets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/queue/?${queryString}`);
  }

  static async getQueueStats() {
    return this.request('/api/queue/stats/');
  }

  static async getQueueFilters() {
    return this.request('/api/queue/filters/');
  }

  static async bulkUpdateTickets(data) {
    return this.request('/api/queue/bulk-update/', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Bulk upload tickets with file handling
  static async bulkUploadTickets(formData) {
    // Get CSRF token using the standard Django cookie name
    const csrfToken = this.getCSRFToken();
    
    // Create a new FormData instance
    const formDataToSend = new FormData();
    
    // Copy all fields from the original formData if it's a FormData object
    if (formData instanceof FormData) {
      for (let [key, value] of formData.entries()) {
        formDataToSend.append(key, value);
      }
    }
    
    // Add CSRF token as both form field and header
    formDataToSend.append('csrfmiddlewaretoken', csrfToken);
    
    try {
      const response = await fetch(`${this.baseURL}/api/queue/upload/`, {
        method: 'POST',
        body: formDataToSend,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrfToken
        }
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error('Upload failed:', response.status, responseData);
        throw new Error(responseData.detail || `Upload failed with status ${response.status}`);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error during upload:', error);
      throw error;
    }
  }

  static async autoAssignTickets() {
    return this.request('/api/queue/auto-assign/', {
      method: 'POST',
    });
  }
}

export default APIService;