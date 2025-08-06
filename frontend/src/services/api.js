// API Service for backend communication
class APIService {
  static baseURL = (process.env.REACT_APP_API_URL || 'http://localhost:8000') + '/api';

  // Try to obtain CSRF token from meta tag first and fall back to cookie
  static getCSRFToken() {
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
      return metaToken.getAttribute('content');
    }
    return this.getCookie('csrftoken');
  }

  // Better cookie parsing when cookie might be missing
  static getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const token = parts.pop().split(';').shift();
      return token || '';
    }
    return '';
  }

  static async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const csrfToken = this.getCSRFToken();
    
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRFToken': csrfToken }),
        ...options.headers,
      },
      ...options,
    };

    // Remove content-type header when sending FormData
    if (config.body instanceof FormData) {
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
      const response = await fetch(`${this.baseURL}/auth/csrf/`, {
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
    return this.request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static async logout() {
    return this.request('/auth/logout/', { method: 'POST' });
  }

  static async getCurrentUser() {
    return this.request('/auth/user/');
  }

  // Ticket methods
  static async deleteTicket(id) {
    return this.request(`/tickets/${id}/`, {
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
      const response = await this.request(`/tickets/?${params.toString()}`);
      
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
    const url = `${this.baseURL}/tickets/export/`;
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

  // Import tickets from CSV
  static async importTicketsCSV(formData) {
    console.log('Sending import request to /tickets/bulk-upload/');
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }
    
    try {
      const response = await this.request('/tickets/bulk-upload/', {
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
    return this.request('/tickets/create/', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  static async getTicketDetail(id) {
    return this.request(`/tickets/${id}/`);
  }

  static async updateTicket(id, data) {
    return this.request(`/tickets/${id}/`, {
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
    
    const response = await this.request(`/admin/cti-records/?${queryParams.toString()}`);
    
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
    
    const response = await this.request(`/cti/?${queryParams.toString()}`);
    
    // Ensure consistent response format
    return {
      count: response.count || 0,
      next: response.next || null,
      previous: response.previous || null,
      results: Array.isArray(response.results) ? response.results : (Array.isArray(response) ? response : [])
    };
  }

  static async getCTIExamples(ctiId) {
    return this.request(`/cti/${ctiId}/examples/`);
  }

  // Admin methods
  static async precomputeEmbeddings() {
    return this.request('/admin/precompute-embeddings/', {
      method: 'POST',
    });
  }

  static async getClassificationStats() {
    return this.request('/admin/stats/');
  }

  // Admin CTI Management methods
  static async getAdminCTIRecords(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/cti/?${queryString}`);
  }

  static async createCTIRecord(data) {
    return this.request('/cti/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateCTIRecord(id, data) {
    return this.request(`/cti/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteCTIRecord(id) {
    return this.request(`/cti/${id}/`, {
      method: 'DELETE',
    });
  }

  static async regenerateCTIEmbedding(id) {
    return this.request(`/cti/${id}/regenerate-embedding/`, {
      method: 'POST',
    });
  }

  static async bulkCTIActions(data) {
    return this.request('/cti/bulk-actions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getCTIFilterOptions() {
    return this.request('/cti/filter-options/');
  }

  // CTI Recommendations methods
  static async getCTIRecommendations() {
    return this.request('/admin/cti-recommendations/');
  }

  static async applyCTIRecommendation(recommendationId, action) {
    return this.request(`/admin/cti-recommendations/${recommendationId}/apply/`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  static async importCTIRecords(formData) {
    return this.request('/cti/import-csv/', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set content-type for FormData
    });
  }

  // Training Examples
  static async getTrainingExamples(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/training-examples/?${queryString}`);
  }

  static async createTrainingExample(data) {
    return this.request('/training-examples/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateTrainingExample(id, data) {
    return this.request(`/training-examples/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteTrainingExample(id) {
    return this.request(`/training-examples/${id}/`, {
      method: 'DELETE',
    });
  }

  static async getCTITrainingExamples(ctiId) {
    return this.request(`/cti/${ctiId}/training-examples/`);
  }

  static async getTrainingStats() {
    return this.request('/training-stats/');
  }

  // AI Performance Analytics
  static async getAIPerformanceAnalytics() {
    return this.request('/ai-performance-analytics/');
  }

  // Smart Recommendations - Implementation moved to the first declaration

  // CTI Trends (for enhanced stats)
  static async getCTITrends() {
    return this.request('/cti-trends/');
  }

  // Table Management - Tickets
  static async getTicketTableData(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/table/tickets/?${queryString}`);
  }

  static async updateTicketTableRow(id, data) {
    return this.request(`/table/tickets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  static async bulkUpdateTicketsTable(data) {
    return this.request('/table/tickets/bulk_update/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async bulkDeleteTickets(ids) {
    return this.request('/table/tickets/bulk_delete/', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  // Table Management - CTI Records
  static async getCTITableData(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/table/cti/?${queryString}`);
  }

  static async updateCTITableRow(id, data) {
    return this.request(`/table/cti/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  static async bulkUpdateCTIRecords(data) {
    return this.request('/table/cti/bulk_update/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async bulkDeleteCTIRecords(ids) {
    return this.request('/table/cti/bulk_delete/', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  // Queue methods
  static async getQueueTickets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/queue/?${queryString}`);
  }

  static async getQueueStats() {
    return this.request('/queue/stats/');
  }

  static async getQueueFilters() {
    return this.request('/queue/filters/');
  }

  static async bulkUpdateTickets(data) {
    return this.request('/queue/bulk-update/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async bulkUploadTickets(formData) {
    // Get CSRF token using the standard Django cookie name
    const csrfToken = this.getCSRFToken();
    
    if (!csrfToken) {
      console.error('No CSRF token found!');
      throw new Error('CSRF token is required but not found. Please refresh the page and try again.');
    }
    
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
      const response = await fetch(`${this.baseURL}/tickets/bulk-upload/`, {
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
    return this.request('/queue/auto-assign/', {
      method: 'POST',
    });
  }
}

export default APIService;