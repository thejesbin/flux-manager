/**
 * RequestStorage - In-Memory HTTP Request Data Management
 * 
 * Provides efficient storage and retrieval of HTTP request/response data for monitoring.
 * Implements a circular buffer pattern to maintain memory efficiency by limiting
 * the maximum number of stored requests. Offers comprehensive filtering, pagination,
 * and statistical analysis capabilities.
 * 
 * Features:
 * - Circular buffer with configurable size limits
 * - Real-time request/response data storage
 * - Advanced filtering by method, status, path, and response time
 * - Pagination support for large datasets
 * - Statistical analysis and metrics calculation
 * - Memory-efficient data management
 * 
 * @author Flux Manager Team
 * @version 1.0.0
 * @license MIT
 * @since 1.0.0
 */

/**
 * RequestStorage Class
 * 
 * Manages in-memory storage of HTTP request/response data with efficient
 * retrieval, filtering, and statistical analysis capabilities.
 * 
 * @class RequestStorage
 * @example
 * const storage = new RequestStorage(500);
 * storage.addRequest(requestData);
 * const stats = storage.getStats();
 */
class RequestStorage {
  /**
   * Create a RequestStorage instance
   * 
   * @param {number} [maxRequests=1000] - Maximum number of requests to store in memory
   *                                      When exceeded, oldest requests are removed (FIFO)
   * 
   * @example
   * // Default storage with 1000 request limit
   * const storage = new RequestStorage();
   * 
   * @example
   * // Custom storage with 500 request limit
   * const storage = new RequestStorage(500);
   */
  constructor(maxRequests = 1000) {
    /**
     * Array storing HTTP request/response data objects
     * Newest requests are at the beginning (index 0)
     * @type {Object[]}
     * @private
     */
    this.requests = [];
    
    /**
     * Maximum number of requests to store in memory
     * @type {number}
     * @private
     */
    this.maxRequests = maxRequests;
  }

  /**
   * Add a new HTTP request/response data object to storage
   * 
   * Implements a FIFO (First In, First Out) circular buffer pattern.
   * New requests are added to the beginning of the array, and when the
   * maximum limit is exceeded, the oldest requests are automatically removed.
   * 
   * @param {Object} requestData - HTTP request/response data object
   * @param {string} requestData.id - Unique identifier for the request
   * @param {string} requestData.method - HTTP method (GET, POST, etc.)
   * @param {string} requestData.path - Request path/URL
   * @param {Object} requestData.headers - Request headers
   * @param {string} requestData.body - Request body content
   * @param {number} requestData.timestamp - Request timestamp
   * @param {Object} [requestData.response] - Response data (if available)
   * @returns {void}
   * 
   * @example
   * storage.addRequest({
   *   id: 'req-123',
   *   method: 'GET',
   *   path: '/api/users',
   *   headers: { 'content-type': 'application/json' },
   *   body: '',
   *   timestamp: Date.now(),
   *   response: { statusCode: 200, responseTime: 45 }
   * });
   */
  addRequest(requestData) {
    // Add to beginning for latest-first ordering
    this.requests.unshift(requestData);
    
    // Maintain memory efficiency by enforcing maximum request limit
    if (this.requests.length > this.maxRequests) {
      this.requests = this.requests.slice(0, this.maxRequests);
    }
  }

  /**
   * Get all stored HTTP request data
   * 
   * Returns the complete array of stored request/response objects,
   * ordered with the most recent requests first.
   * 
   * @returns {Object[]} Array of all stored request objects
   * 
   * @example
   * const allRequests = storage.getAll();
   * console.log(`Total requests: ${allRequests.length}`);
   */
  getAll() {
    return this.requests;
  }

  /**
   * Get a specific HTTP request by its unique identifier
   * 
   * @param {string} id - Unique request identifier
   * @returns {Object|undefined} Request object if found, undefined otherwise
   * 
   * @example
   * const request = storage.getById('req-123');
   * if (request) {
   *   console.log(`Found request: ${request.method} ${request.path}`);
   * }
   */
  getById(id) {
    return this.requests.find(req => req.id === id);
  }

  /**
   * Get paginated HTTP request data
   * 
   * Provides efficient pagination support for large datasets by returning
   * a subset of requests along with pagination metadata.
   * 
   * @param {number} [page=1] - Page number (1-based indexing)
   * @param {number} [limit=50] - Number of requests per page
   * @returns {Object} Pagination result object
   * @returns {Object[]} returns.requests - Array of request objects for the current page
   * @returns {number} returns.total - Total number of stored requests
   * @returns {number} returns.page - Current page number
   * @returns {number} returns.limit - Number of requests per page
   * @returns {number} returns.totalPages - Total number of pages available
   * 
   * @example
   * // Get first page with default 50 requests per page
   * const page1 = storage.getPaginated();
   * 
   * @example
   * // Get page 2 with 25 requests per page
   * const page2 = storage.getPaginated(2, 25);
   * console.log(`Page ${page2.page} of ${page2.totalPages}`);
   */
  getPaginated(page = 1, limit = 50) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      requests: this.requests.slice(startIndex, endIndex),
      total: this.requests.length,
      page: page,
      limit: limit,
      totalPages: Math.ceil(this.requests.length / limit)
    };
  }

  /**
   * Filter HTTP requests by multiple criteria
   * 
   * Provides advanced filtering capabilities to search and filter requests
   * based on HTTP method, status code, path patterns, and response time ranges.
   * All criteria are applied using AND logic (all conditions must match).
   * 
   * @param {Object} [criteria={}] - Filter criteria object
   * @param {string} [criteria.method] - HTTP method to filter by (case-insensitive)
   * @param {string|number} [criteria.status] - HTTP status code to filter by
   * @param {string} [criteria.path] - Path substring to search for (case-sensitive)
   * @param {number} [criteria.minResponseTime] - Minimum response time in milliseconds
   * @param {number} [criteria.maxResponseTime] - Maximum response time in milliseconds
   * @returns {Object[]} Array of filtered request objects
   * 
   * @example
   * // Filter POST requests with 200 status
   * const postRequests = storage.filter({ method: 'POST', status: 200 });
   * 
   * @example
   * // Filter slow requests (>1000ms) to API endpoints
   * const slowApiRequests = storage.filter({
   *   path: '/api/',
   *   minResponseTime: 1000
   * });
   * 
   * @example
   * // Filter error responses
   * const errorRequests = storage.filter({ status: 500 });
   */
  filter(criteria = {}) {
    let filtered = this.requests;

    if (criteria.method) {
      filtered = filtered.filter(req => 
        req.method.toLowerCase() === criteria.method.toLowerCase()
      );
    }

    if (criteria.status) {
      filtered = filtered.filter(req => 
        req.response && req.response.statusCode.toString() === criteria.status.toString()
      );
    }

    if (criteria.path) {
      filtered = filtered.filter(req => 
        req.path.includes(criteria.path)
      );
    }

    if (criteria.minResponseTime) {
      filtered = filtered.filter(req => 
        req.response && req.response.responseTime >= criteria.minResponseTime
      );
    }

    if (criteria.maxResponseTime) {
      filtered = filtered.filter(req => 
        req.response && req.response.responseTime <= criteria.maxResponseTime
      );
    }

    return filtered;
  }

  /**
   * Clear all stored HTTP request data
   * 
   * Removes all requests from memory storage, effectively resetting
   * the storage to its initial empty state. This operation is irreversible.
   * 
   * @returns {void}
   * 
   * @example
   * // Clear all monitoring data
   * storage.clear();
   * console.log(`Requests after clear: ${storage.getAll().length}`); // 0
   */
  clear() {
    this.requests = [];
  }

  /**
   * Generate comprehensive statistics from stored HTTP request data
   * 
   * Analyzes all stored requests to provide detailed metrics including
   * request counts by method and status code, and average response times.
   * This method is useful for monitoring application performance and usage patterns.
   * 
   * @returns {Object} Statistics object containing comprehensive metrics
   * @returns {number} returns.total - Total number of stored requests
   * @returns {Object} returns.methods - Count of requests by HTTP method (GET, POST, etc.)
   * @returns {Object} returns.statusCodes - Count of responses by HTTP status code
   * @returns {number} returns.averageResponseTime - Average response time in milliseconds
   * 
   * @example
   * const stats = storage.getStats();
   * console.log(`Total requests: ${stats.total}`);
   * console.log(`GET requests: ${stats.methods.GET || 0}`);
   * console.log(`Average response time: ${stats.averageResponseTime}ms`);
   * 
   * @example
   * // Monitor error rates
   * const stats = storage.getStats();
   * const errorCount = (stats.statusCodes['500'] || 0) + (stats.statusCodes['404'] || 0);
   * const errorRate = (errorCount / stats.total) * 100;
   * console.log(`Error rate: ${errorRate.toFixed(2)}%`);
   */
  getStats() {
    const total = this.requests.length;
    const methods = {};
    const statusCodes = {};
    let totalResponseTime = 0;
    let validResponseTimes = 0;

    this.requests.forEach(req => {
      // Count methods
      methods[req.method] = (methods[req.method] || 0) + 1;
      
      // Count status codes
      if (req.response) {
        const status = req.response.statusCode;
        statusCodes[status] = (statusCodes[status] || 0) + 1;
        
        // Calculate average response time
        if (req.response.responseTime) {
          totalResponseTime += req.response.responseTime;
          validResponseTimes++;
        }
      }
    });

    return {
      total,
      methods,
      statusCodes,
      averageResponseTime: validResponseTimes > 0 ? Math.round(totalResponseTime / validResponseTimes) : 0
    };
  }
}

export default RequestStorage;
