/**
 * FluxManager Frontend - Dashboard User Interface
 * 
 * Provides a modern, real-time dashboard for monitoring HTTP requests in Node.js applications.
 * Features include request filtering, detailed modal views, WebSocket live updates, and
 * comprehensive copy-to-clipboard functionality for debugging workflows.
 * 
 * Key Features:
 * - Real-time WebSocket connection for live request updates
 * - Advanced filtering by method, status code, and path
 * - Modern tabbed modal interface for request details
 * - Copy-to-clipboard functionality for all request/response data
 * - Professional purple-themed UI matching FluxManager branding
 * - Responsive design with fixed-height modal layout
 * 
 * @author Flux Manager Team
 * @version 1.0.0
 * @license MIT
 * @since 1.0.0
 */

/**
 * FluxManagerUI Class
 * 
 * Main frontend controller class that manages the dashboard interface,
 * WebSocket connections, request filtering, and modal interactions.
 * 
 * @class FluxManagerUI
 * @example
 * // Initialize the dashboard (automatically done on DOM load)
 * const ui = new FluxManagerUI();
 */
class FluxManagerUI {
    /**
     * Initialize the FluxManager dashboard interface
     * 
     * Sets up the core data structures, WebSocket connection, event listeners,
     * and loads initial request data from the backend API.
     * 
     * @constructor
     * @example
     * const dashboard = new FluxManagerUI();
     */
    constructor() {
        /** @type {Array} Array of all HTTP requests from the backend */
        this.requests = [];
        
        /** @type {Array} Filtered array of requests based on current filter criteria */
        this.filteredRequests = [];
        
        /** @type {Object} Current filter settings for request display */
        this.currentFilters = {
            method: '',   // HTTP method filter (GET, POST, etc.)
            status: '',   // Status code filter (200, 404, etc.)
            path: ''      // URL path filter (partial match)
        };
        
        /** @type {WebSocket|null} WebSocket connection for real-time updates */
        this.ws = null;
        
        /** @type {boolean} WebSocket connection status indicator */
        this.isConnected = false;
        
        // Initialize the dashboard components
        this.init();
    }

    /**
     * Initialize all dashboard components
     * 
     * Sets up event listeners, establishes WebSocket connection,
     * loads initial request data, and displays statistics.
     * Called automatically during constructor execution.
     * 
     * @method init
     * @private
     */
    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadRequests();
        this.loadStats();
    }

    /**
     * Set up all DOM event listeners for dashboard interactions
     * 
     * Configures click handlers for buttons, modal interactions,
     * and keyboard shortcuts for enhanced user experience.
     * 
     * @method setupEventListeners
     * @private
     */
    setupEventListeners() {
        // Clear all requests button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearRequests();
        });

        // Refresh requests button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadRequests();
            this.loadStats();
        });

        // Request filtering controls
        // HTTP method filter (GET, POST, PUT, DELETE, etc.)
        document.getElementById('methodFilter').addEventListener('change', (e) => {
            this.currentFilters.method = e.target.value;
            this.applyFilters();
        });

        // HTTP status code filter (200, 404, 500, etc.)
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.applyFilters();
        });

        // URL path filter with debounced input for performance
        document.getElementById('pathFilter').addEventListener('input', (e) => {
            this.currentFilters.path = e.target.value;
            this.debounce(() => this.applyFilters(), 300)();
        });

        // Modal close button handler
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking on backdrop (outside modal content)
        document.getElementById('requestModal').addEventListener('click', (e) => {
            if (e.target.id === 'requestModal') {
                this.closeModal();
            }
        });

        // ESC key to close modal for better UX
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    /**
     * Establish WebSocket connection for real-time updates
     * 
     * Creates a WebSocket connection to receive live HTTP request updates
     * from the FluxManager backend. Handles connection events, message parsing,
     * and automatic reconnection on connection loss.
     * 
     * @method connectWebSocket
     * @private
     * @example
     * // WebSocket automatically connects on initialization
     * this.connectWebSocket();
     */
    connectWebSocket() {
        // Determine WebSocket protocol based on current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${window.location.pathname}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            // WebSocket connection established successfully
            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus();
                console.log('WebSocket connected');
            };

            // Handle incoming real-time messages from backend
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'new_request') {
                    this.addNewRequest(message.data);
                }
            };

            // Handle WebSocket connection closure
            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus();
                console.log('WebSocket disconnected');
                
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    this.connectWebSocket();
                }, 3000);
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus();
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    /**
     * Update WebSocket connection status indicator in the UI
     * 
     * Updates the visual connection status indicator to show whether
     * the WebSocket connection is active or disconnected.
     * 
     * @method updateConnectionStatus
     * @private
     */
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        const statusText = statusElement.querySelector('span');
        
        if (this.isConnected) {
            statusElement.className = 'connection-status connected';
            statusText.textContent = 'Connected';
        } else {
            statusElement.className = 'connection-status disconnected';
            statusText.textContent = 'Disconnected';
        }
    }

    /**
     * Load HTTP requests from the FluxManager backend API
     * 
     * Fetches all captured HTTP requests from the backend API endpoint,
     * updates the local requests array, applies current filters, and
     * updates the sidebar count. Handles errors gracefully with user feedback.
     * 
     * @method loadRequests
     * @async
     * @returns {Promise<void>}
     * @example
     * // Refresh request data from backend
     * await this.loadRequests();
     */
    async loadRequests() {
        try {
            const response = await fetch(`${window.location.pathname}/api/requests`);
            const result = await response.json();
            
            if (result.success) {
                this.requests = result.data.requests;
                this.applyFilters();
                this.updateSidebarCount(); // Update sidebar count on initial load
            }
        } catch (error) {
            console.error('Failed to load requests:', error);
            // Show error message instead of infinite loading
            const requestList = document.getElementById('requestList');
            requestList.innerHTML = `
                <div class="loading">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Failed to load requests. Please refresh the page.</span>
                </div>
            `;
        }
    }

    async loadStats() {
        try {
            const response = await fetch(`${window.location.pathname}/api/stats`);
            const result = await response.json();
            
            if (result.success) {
                this.updateStats(result.data);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('totalRequests').textContent = stats.total;
        document.getElementById('avgResponseTime').textContent = `${stats.averageResponseTime}ms`;
        
        // Calculate success rate (2xx status codes)
        const successCount = Object.entries(stats.statusCodes)
            .filter(([status]) => status.startsWith('2'))
            .reduce((sum, [, count]) => sum + count, 0);
        const successRate = stats.total > 0 ? Math.round((successCount / stats.total) * 100) : 0;
        document.getElementById('successRate').textContent = `${successRate}%`;
    }

    updateSidebarCount() {
        const requestCountElement = document.getElementById('requestCount');
        if (requestCountElement) {
            requestCountElement.textContent = this.requests.length;
        }
    }

    addNewRequest(request) {
        this.requests.unshift(request);
        this.applyFilters();
        this.loadStats(); // Refresh stats
        this.updateSidebarCount(); // Update sidebar HTTP request count
        
        // Add a subtle animation to indicate new request
        setTimeout(() => {
            const firstItem = document.querySelector('.request-item');
            if (firstItem) {
                firstItem.style.animation = 'slideUp 0.3s ease';
            }
        }, 100);
    }

    applyFilters() {
        this.filteredRequests = this.requests.filter(request => {
            if (this.currentFilters.method && request.method !== this.currentFilters.method) {
                return false;
            }
            
            if (this.currentFilters.status && 
                request.response && 
                request.response.statusCode.toString() !== this.currentFilters.status) {
                return false;
            }
            
            if (this.currentFilters.path && 
                !request.path.toLowerCase().includes(this.currentFilters.path.toLowerCase())) {
                return false;
            }
            
            return true;
        });
        
        this.renderRequests();
    }

    renderRequests() {
        const requestList = document.getElementById('requestList');
        const loading = document.getElementById('loading');
        
        if (loading) {
            loading.remove();
        }
        
        if (this.filteredRequests.length === 0) {
            requestList.innerHTML = `
                <div class="loading">
                    <i class="fas fa-search"></i>
                    <span>No requests found</span>
                </div>
            `;
            return;
        }
        
        const requestsHTML = this.filteredRequests.map(request => {
            const statusClass = this.getStatusClass(request.response?.statusCode);
            const methodClass = `method-${request.method.toLowerCase()}`;
            const timestamp = new Date(request.timestamp).toLocaleTimeString();
            const responseTime = request.response?.responseTime || 0;
            
            return `
                <div class="request-item" data-id="${request.id}">
                    <span class="method-badge ${methodClass}">${request.method}</span>
                    <span class="request-path">${request.path}</span>
                    <span class="status-badge ${statusClass}">${request.response?.statusCode || 'Pending'}</span>
                    <span class="response-time">${responseTime}ms</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
            `;
        }).join('');
        
        requestList.innerHTML = requestsHTML;
        
        // Add click listeners to request items
        requestList.querySelectorAll('.request-item').forEach(item => {
            item.addEventListener('click', () => {
                const requestId = item.dataset.id;
                this.showRequestDetail(requestId);
            });
        });
    }

    getStatusClass(statusCode) {
        if (!statusCode) return 'status-pending';
        if (statusCode >= 200 && statusCode < 300) return 'status-2xx';
        if (statusCode >= 300 && statusCode < 400) return 'status-3xx';
        if (statusCode >= 400 && statusCode < 500) return 'status-4xx';
        if (statusCode >= 500) return 'status-5xx';
        return '';
    }

    async showRequestDetail(requestId) {
        try {
            const response = await fetch(`${window.location.pathname}/api/requests/${requestId}`);
            const result = await response.json();
            
            if (result.success) {
                this.renderRequestDetail(result.data);
                this.openModal();
            }
        } catch (error) {
            console.error('Failed to load request detail:', error);
        }
    }

    renderRequestDetail(request) {
        // Update method badge
        const methodBadge = document.getElementById('modalMethodBadge');
        methodBadge.textContent = request.method;
        methodBadge.className = `request-method-badge method-${request.method}`;
        
        // Populate Overview Tab
        this.populateOverviewTab(request);
        
        // Populate Headers Tab
        this.populateHeadersTab(request);
        
        // Populate Request Tab
        this.populateRequestTab(request);
        
        // Populate Response Tab
        this.populateResponseTab(request);
        
        // Populate Timing Tab
        this.populateTimingTab(request);
        
        // Initialize tab functionality
        this.initializeModalTabs();
    }
    
    populateOverviewTab(request) {
        // Request meta cards
        const requestMeta = document.getElementById('requestMeta');
        const statusClass = this.getStatusClass(request.response?.statusCode);
        
        requestMeta.innerHTML = `
            <div class="meta-card">
                <h4>Status Code</h4>
                <div class="value ${statusClass}">${request.response?.statusCode || 'Pending'}</div>
            </div>
            <div class="meta-card">
                <h4>Response Time</h4>
                <div class="value">${request.response?.responseTime || 0}ms</div>
            </div>
            <div class="meta-card">
                <h4>Method</h4>
                <div class="value">${request.method}</div>
            </div>
            <div class="meta-card">
                <h4>Content Length</h4>
                <div class="value">${this.formatBytes(request.response?.contentLength || 0)}</div>
            </div>
        `;
        
        // Request URL
        const requestUrl = document.getElementById('requestUrl');
        requestUrl.textContent = request.url || request.path;
    }
    
    populateHeadersTab(request) {
        // Request headers
        const requestHeaders = document.getElementById('requestHeaders');
        requestHeaders.innerHTML = this.formatHeadersAsKeyValue(request.headers);
        
        // Response headers
        const responseHeaders = document.getElementById('responseHeaders');
        responseHeaders.innerHTML = request.response ? 
            this.formatHeadersAsKeyValue(request.response.headers) : 
            '<div class="key-value-item"><div class="key-value-key">No Data</div><div class="key-value-value">No response headers available</div></div>';
    }
    
    populateRequestTab(request) {
        // Request body
        const requestBody = document.getElementById('requestBody');
        requestBody.textContent = this.formatBody(request.body);
        
        // Query parameters
        const queryParams = document.getElementById('queryParams');
        const url = new URL(request.url, 'http://localhost');
        const params = Object.fromEntries(url.searchParams);
        
        if (Object.keys(params).length > 0) {
            queryParams.innerHTML = Object.entries(params)
                .map(([key, value]) => `
                    <div class="key-value-item">
                        <div class="key-value-key">${this.escapeHtml(key)}</div>
                        <div class="key-value-value">${this.escapeHtml(value)}</div>
                    </div>
                `).join('');
        } else {
            queryParams.innerHTML = '<div class="key-value-item"><div class="key-value-key">No Parameters</div><div class="key-value-value">No query parameters found</div></div>';
        }
    }
    
    populateResponseTab(request) {
        const responseBody = document.getElementById('responseBody');
        responseBody.textContent = request.response ? 
            this.formatBody(request.response.body) : 
            'No response body available';
    }
    
    populateTimingTab(request) {
        const timingMetrics = document.getElementById('timingMetrics');
        const timestamp = new Date(request.timestamp);
        
        timingMetrics.innerHTML = `
            <div class="key-value-item">
                <div class="key-value-key">Request Time</div>
                <div class="key-value-value">${timestamp.toLocaleString()}</div>
            </div>
            <div class="key-value-item">
                <div class="key-value-key">Response Time</div>
                <div class="key-value-value">${request.response?.responseTime || 0}ms</div>
            </div>
            <div class="key-value-item">
                <div class="key-value-key">IP Address</div>
                <div class="key-value-value">${request.ip || 'Unknown'}</div>
            </div>
            <div class="key-value-item">
                <div class="key-value-key">User Agent</div>
                <div class="key-value-value">${request.userAgent || 'Unknown'}</div>
            </div>
            <div class="key-value-item">
                <div class="key-value-key">Request ID</div>
                <div class="key-value-value">${request.id}</div>
            </div>
        `;
    }
    
    /**
     * Initialize modal tabs
     * 
     * Sets up event listeners for modal tabs to switch between different panes.
     * Each tab is associated with a specific pane, and clicking a tab will show
     * the corresponding pane while hiding others.
     * 
     * @method initializeModalTabs
     * @private
     * @example
     * // Initialize modal tabs on page load
     * this.initializeModalTabs();
     */
    initializeModalTabs() {
        const tabs = document.querySelectorAll('.modal-tab');
        const panes = document.querySelectorAll('.modal-tab-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from all tabs and panes
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding pane
                tab.classList.add('active');
                document.getElementById(`tab-${targetTab}`).classList.add('active');
            });
        });
    }
    
    formatHeadersAsKeyValue(headers) {
        if (!headers || typeof headers !== 'object') {
            return '<div class="key-value-item"><div class="key-value-key">No Headers</div><div class="key-value-value">No headers available</div></div>';
        }
        
        return Object.entries(headers)
            .map(([key, value]) => `
                <div class="key-value-item">
                    <div class="key-value-key">${this.escapeHtml(key)}</div>
                    <div class="key-value-value">${this.escapeHtml(String(value))}</div>
                </div>
            `).join('');
    }
    
    getStatusClass(statusCode) {
        if (!statusCode) return '';
        if (statusCode >= 200 && statusCode < 300) return 'status-200';
        if (statusCode >= 300 && statusCode < 400) return 'status-300';
        if (statusCode >= 400 && statusCode < 500) return 'status-400';
        if (statusCode >= 500) return 'status-500';
        return '';
    }
    
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatBody(body) {
        if (!body || body.trim() === '') {
            return 'No body content';
        }
        
        try {
            // Try to parse and pretty-print JSON
            const parsed = JSON.parse(body);
            return JSON.stringify(parsed, null, 2);
        } catch {
            // Return as-is if not JSON
            return body;
        }
    }

    /**
     * Open the request details modal
     * 
     * Displays the modal with request details and prevents body scrolling
     * while the modal is open for better user experience.
     * 
     * @method openModal
     * @public
     */
    openModal() {
        document.getElementById('requestModal').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the request details modal
     * 
     * Hides the modal and restores body scrolling functionality.
     * Can be triggered by close button, ESC key, or backdrop click.
     * 
     * @method closeModal
     * @public
     */
    closeModal() {
        document.getElementById('requestModal').classList.remove('show');
        document.body.style.overflow = '';
    }

    async clearRequests() {
        if (!confirm('Are you sure you want to clear all requests?')) {
            return;
        }
        
        try {
            const response = await fetch(`${window.location.pathname}/api/requests`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                this.requests = [];
                this.filteredRequests = [];
                this.renderRequests();
                this.loadStats();
            }
        } catch (error) {
            console.error('Failed to clear requests:', error);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Copy to clipboard functionality
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let textToCopy = '';
    
    // Handle different element types
    if (element.tagName === 'PRE') {
        textToCopy = element.textContent;
    } else if (element.classList.contains('key-value-list')) {
        // Extract key-value pairs as text
        const items = element.querySelectorAll('.key-value-item');
        textToCopy = Array.from(items).map(item => {
            const key = item.querySelector('.key-value-key')?.textContent || '';
            const value = item.querySelector('.key-value-value')?.textContent || '';
            return `${key}: ${value}`;
        }).join('\n');
    } else {
        textToCopy = element.textContent;
    }
    
    // Copy to clipboard using modern API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopySuccess(event.target);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(textToCopy, event.target);
        });
    } else {
        fallbackCopyTextToClipboard(textToCopy, event.target);
    }
}

// Fallback copy method for older browsers
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess(button);
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }
    
    document.body.removeChild(textArea);
}

// Show copy success feedback
function showCopySuccess(button) {
    if (!button) return;
    
    const originalText = button.textContent;
    button.classList.add('copied');
    button.textContent = '✓ Copied!';
    
    setTimeout(() => {
        button.classList.remove('copied');
        button.textContent = originalText;
    }, 2000);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Flux Manager UI...');
    try {
        const fluxManagerUI = new FluxManagerUI();
        console.log('Flux Manager UI initialized successfully');
    } catch (error) {
        console.error('Error initializing Flux Manager UI:', error);
    }
});
