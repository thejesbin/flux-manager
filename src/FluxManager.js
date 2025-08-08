/**
 * FluxManager - Universal Node.js Application Monitoring and Debugging Tool
 * 
 * A framework-agnostic HTTP request monitoring solution.
 * Provides real-time request tracking, performance analytics, and debugging capabilities
 * for any Node.js HTTP framework or standalone applications.
 * 
 * Key Features:
 * - Framework-agnostic architecture (Express, Koa, Fastify, native HTTP, etc.)
 * - Real-time WebSocket updates
 * - Built-in dashboard with modern UI
 * - Request/response interception and analysis
 * - Performance metrics and statistics
 * - Route-agnostic asset serving
 * - ES6 module support
 * - Zero external framework dependencies
 * 
 * @author Flux Manager Team
 * @version 1.0.0
 * @license MIT
 * @since 1.0.0
 */

import path from 'path';
import http from 'http';
import url from 'url';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import RequestStorage from './storage/RequestStorage.js';

// ES6 module compatibility - Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * FluxManager Class
 * 
 * The main class that provides HTTP request monitoring and debugging capabilities.
 * Supports multiple integration patterns:
 * 
 * 1. Standalone Mode - Independent monitoring service
 * 2. Framework Integration - Attach to existing applications
 * 3. Manual Interception - Direct request/response monitoring
 * 
 * @class FluxManager
 * @example
 * // Standalone usage
 * const fluxManager = new FluxManager({ port: 3001, route: '/debug' });
 * 
 * @example
 * // Express integration
 * const fluxManager = new FluxManager({ route: '/monitor' });
 * app.use(fluxManager.expressMiddleware());
 * 
 * @example
 * // Universal attachment
 * const fluxManager = FluxManager.attach(app, { route: '/debug' });
 */
class FluxManager {
  /**
   * Create a FluxManager instance
   * 
   * @param {Object} options - Configuration options for FluxManager
   * @param {number} [options.port=3001] - Port for the built-in HTTP server
   * @param {string} [options.route='/flux-manager'] - Base route for dashboard and API
   * @param {number} [options.maxRequests=1000] - Maximum number of requests to store in memory
   * @param {boolean} [options.enableWebSocket=true] - Enable WebSocket for real-time updates
   * @param {boolean} [options.autoStart=true] - Automatically start the built-in server
   * @param {Object} [options.cors] - CORS configuration for API endpoints
   * @param {string[]} [options.ignorePaths] - Paths to ignore during monitoring
   * @param {Function} [options.onRequest] - Callback function called for each request
   * @param {Function} [options.onResponse] - Callback function called for each response
   * 
   * @example
   * const fluxManager = new FluxManager({
   *   port: 3001,
   *   route: '/debug',
   *   maxRequests: 500,
   *   enableWebSocket: true,
   *   ignorePaths: ['/health', '/metrics']
   * });
   */
  constructor(options = {}) {
    /**
     * Configuration options for this FluxManager instance
     * @type {Object}
     * @private
     */
    this.options = {
      port: options.port || 3001,
      route: options.route || '/flux-manager',
      maxRequests: options.maxRequests || 1000,
      enableWebSocket: options.enableWebSocket !== false,
      autoStart: options.autoStart !== false,
      ...options
    };
    
    /**
     * Request storage instance for managing captured requests
     * @type {RequestStorage}
     * @private
     */
    this.storage = new RequestStorage(this.options.maxRequests);
    
    /**
     * Built-in HTTP server instance
     * @type {http.Server|null}
     * @private
     */
    this.server = null;
    
    /**
     * WebSocket server instance for real-time updates
     * @type {WebSocketServer|null}
     * @private
     */
    this.wss = null;
    
    /**
     * Flag indicating if monitoring is enabled
     * @type {boolean}
     * @private
     */
    this.isEnabled = true;
    
    // Auto-start the built-in server if enabled
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Start the built-in HTTP server and WebSocket server
   * 
   * Creates an independent HTTP server that serves the dashboard UI and API endpoints.
   * Also initializes the WebSocket server for real-time updates if enabled.
   * This method is automatically called if autoStart is true in the constructor.
   * 
   * @returns {FluxManager} Returns this instance for method chaining
   * @throws {Error} Throws an error if the server fails to start
   * 
   * @example
   * const fluxManager = new FluxManager({ autoStart: false });
   * fluxManager.start();
   * 
   * @example
   * // Method chaining
   * const fluxManager = new FluxManager({ autoStart: false })
   *   .start()
   *   .enable();
   */
  start() {
    if (this.server) {
      console.log('FluxManager: Server already running');
      return this;
    }

    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    this.server.listen(this.options.port, () => {
      console.log(`🚀 Flux Manager running on http://localhost:${this.options.port}`);
      console.log(`🔍 Access dashboard at: http://localhost:${this.options.port}${this.options.route}`);
    });

    // Setup WebSocket server
    if (this.options.enableWebSocket) {
      this._setupWebSocket(this.server);
    }

    return this;
  }

  /**
   * Intercept and monitor HTTP requests and responses
   * 
   * This is the core method that captures HTTP request/response data for monitoring.
   * It works with any Node.js HTTP framework by intercepting the native request/response objects.
   * The method automatically skips monitoring requests to the FluxManager dashboard itself
   * and other system/browser requests that aren't relevant for debugging.
   * 
   * @param {http.IncomingMessage} req - The HTTP request object
   * @param {http.ServerResponse} res - The HTTP response object
   * @param {Function} [next] - Optional next function for middleware compatibility
   * @returns {void}
   * 
   * @example
   * // Express middleware usage
   * app.use((req, res, next) => {
   *   fluxManager.intercept(req, res, next);
   * });
   * 
   * @example
   * // Native HTTP server usage
   * const server = http.createServer((req, res) => {
   *   fluxManager.intercept(req, res);
   *   // Handle request normally...
   * });
   * 
   * @example
   * // Manual interception
   * fluxManager.intercept(req, res);
   */
  intercept(req, res, next = null) {
    if (!this.isEnabled) {
      return next && next();
    }

    // Skip if this is a request to the debugger itself
    const parsedUrl = url.parse(req.url);
    if (parsedUrl.pathname.startsWith(this.options.route)) {
      return next && next();
    }

    // Skip system/browser requests that aren't relevant for debugging
    const skipPaths = [
      '/.well-known/',
      '/favicon.ico',
      '/__webpack_hmr',
      '/sockjs-node/',
      '/_next/static/',
      '/static/'
    ];
    
    if (skipPaths.some(skipPath => parsedUrl.pathname.startsWith(skipPath))) {
      return next && next();
    }

    const requestId = uuidv4();
    const startTime = Date.now();
    
    // Capture request data (framework-agnostic)
    const requestData = {
      id: requestId,
      method: req.method,
      path: parsedUrl.pathname,
      url: req.url,
      headers: { ...req.headers },
      query: this._parseQuery(parsedUrl.query),
      body: this._captureBody(req),
      ip: req.connection.remoteAddress || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      startTime: startTime
    };

    // Override res.end to capture response (works with any framework)
    const originalEnd = res.end;
    const originalWrite = res.write;
    let responseBody = '';

    res.write = function(chunk, encoding) {
      if (chunk) {
        responseBody += chunk.toString();
      }
      return originalWrite.call(this, chunk, encoding);
    };

    const self = this;
    res.end = function(chunk, encoding) {
      if (chunk) {
        responseBody += chunk.toString();
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Capture response data (framework-agnostic)
      const responseData = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage || '',
        headers: { ...res.getHeaders() },
        body: responseBody,
        responseTime: responseTime
      };

      // Only capture successful responses or clear errors
      const shouldCapture = res.statusCode < 300 || res.statusCode >= 400;
      
      if (shouldCapture) {
        // Store the complete request/response data
        const completeData = {
          ...requestData,
          response: responseData,
          endTime: new Date().toISOString()
        };

        self.storage.addRequest(completeData);
        
        // Broadcast to WebSocket clients
        self._broadcastToClients(completeData);
      }

      return originalEnd.call(res, chunk, encoding);
    };

    // Call next if provided (for middleware pattern)
    if (next) {
      next();
    }
  }

  /**
   * 🌐 FRAMEWORK-AGNOSTIC: Built-in HTTP request handler
   * Serves the dashboard and API without any framework dependency
   */
  _handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve dashboard and API routes
    if (pathname.startsWith(this.options.route)) {
      const subPath = pathname.substring(this.options.route.length) || '/';
      

      
      // API Routes
      if (subPath.startsWith('/api/')) {
        return this._handleApiRequest(req, res, subPath);
      }
      
      // Static files - Handle all possible path variations
      const fileName = subPath.replace(/^\/+/, ''); // Remove leading slashes
      
      if (fileName === 'app.js' || subPath.endsWith('/app.js')) {
        return this._serveFile(res, path.join(__dirname, '../frontend/dist/app.js'), 'application/javascript');
      }
      if (fileName === 'styles.css' || subPath.endsWith('/styles.css')) {
        return this._serveFile(res, path.join(__dirname, '../frontend/dist/styles.css'), 'text/css');
      }
      if (fileName === 'index.html' || subPath.endsWith('/index.html')) {
        return this._serveFile(res, path.join(__dirname, '../frontend/dist/index.html'), 'text/html');
      }
      
      // Dashboard UI
      if (subPath === '/' || subPath === '') {
        return this._serveDynamicHTML(res);
      }
    }

    // Not a Flux Manager route - return 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  /**
   * Handle API requests
   */
  _handleApiRequest(req, res, subPath) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    try {
      if (subPath === '/api/requests' && req.method === 'GET') {
        const requests = this.storage.getAll();
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: { requests, total: requests.length } }));
      }
      
      // Individual request details route
      if (subPath.startsWith('/api/requests/') && req.method === 'GET') {
        const requestId = subPath.split('/api/requests/')[1];
        const request = this.storage.getById(requestId);
        
        if (request) {
          res.writeHead(200);
          return res.end(JSON.stringify({ success: true, data: request }));
        } else {
          res.writeHead(404);
          return res.end(JSON.stringify({ success: false, error: 'Request not found' }));
        }
      }
      
      if (subPath === '/api/stats' && req.method === 'GET') {
        const stats = this.storage.getStats();
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: stats }));
      }
      
      if (subPath === '/api/requests' && req.method === 'DELETE') {
        this.storage.clear();
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, message: 'All requests cleared' }));
      }

      // Route not found
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'API route not found' }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  }

  /**
   * Serve dynamic HTML with route-agnostic asset paths
   * Dynamically replaces route placeholders in the HTML template
   * to ensure frontend assets load correctly regardless of the configured route
   * 
   * @private
   * @param {http.ServerResponse} res - HTTP response object
   */
  _serveDynamicHTML(res) {
    try {
      const htmlPath = path.join(__dirname, '../frontend/dist/index.html');
      
      if (fs.existsSync(htmlPath)) {
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Replace route placeholders with the actual configured route
        // This ensures frontend assets (JS, CSS) load from the correct paths
        htmlContent = htmlContent.replace(/{{FLUX_MANAGER_ROUTE}}/g, this.options.route);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('HTML template not found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  }

  /**
   * Handle API requests for same-port integration
   * Routes API calls to the appropriate handlers
   * 
   * @private
   * @param {http.IncomingMessage} req - HTTP request object
   * @param {http.ServerResponse} res - HTTP response object
   */
  _handleAPIRequest(req, res) {
    // Parse the API path
    const apiPath = req.path.replace('/api', '');
    
    if (apiPath === '/requests' && req.method === 'GET') {
      return this._handleRequestsAPI(req, res);
    } else if (apiPath.startsWith('/requests/') && req.method === 'GET') {
      return this._handleRequestDetailAPI(req, res);
    } else if (apiPath === '/stats' && req.method === 'GET') {
      return this._handleStatsAPI(req, res);
    } else if (apiPath === '/requests' && req.method === 'DELETE') {
      return this._handleClearRequestsAPI(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'API endpoint not found' }));
    }
  }

  /**
   * Get content type for file extension
   * 
   * @private
   * @param {string} filePath - File path to determine content type for
   * @returns {string} MIME type
   */
  _getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon'
    };
    return contentTypes[ext] || 'text/plain';
  }

  /**
   * Serve static files (CSS, JS, etc.) for the dashboard
   * 
   * @private
   * @param {http.ServerResponse} res - HTTP response object
   * @param {string} filePath - Relative path to the file to serve
   * @param {string} contentType - MIME type for the Content-Type header
   */
  _serveFile(res, filePath, contentType) {
    try {
      const fullPath = path.join(__dirname, '../frontend/dist', filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  }

  /**
   * Parse query string manually (framework-agnostic)
   */
  _parseQuery(queryString) {
    if (!queryString) return {};
    
    const params = {};
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    return params;
  }

  /**
   * Setup WebSocket server with the HTTP server instance
   * Call this method after creating your HTTP server
   */
  setupWebSocket(server) {
    if (this.options.enableWebSocket) {
      this._setupWebSocket(server);
    }
  }

  /**
   * Setup WebSocket server for real-time updates
   * This should be called after the HTTP server is created
   */
  _setupWebSocket(server) {
    this.wss = new WebSocketServer({ 
      server: server,
      path: `${this.options.route}/ws`
    });

    this.wss.on('connection', (ws) => {
      console.log('FluxManager: WebSocket client connected');
      
      ws.on('close', () => {
        console.log('FluxManager: WebSocket client disconnected');
      });
      
      ws.on('error', (error) => {
        console.error('FluxManager: WebSocket error:', error);
      });
    });
    
    console.log(`FluxManager: WebSocket server ready at ${this.options.route}/ws`);
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  _broadcastToClients(data) {
    if (this.wss && this.isEnabled) {
      const message = JSON.stringify({
        type: 'new_request',
        data: data
      });
      
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  /**
   * Capture request body safely
   */
  _captureBody(req) {
    try {
      if (req.body) {
        return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
      return '';
    } catch (error) {
      return '[Unable to capture body]';
    }
  }

  /**
   * Enable or disable request monitoring
   * 
   * When disabled, FluxManager will stop intercepting and storing new requests,
   * but existing data and the dashboard will remain accessible.
   * 
   * @param {boolean} enabled - True to enable monitoring, false to disable
   * @returns {void}
   * 
   * @example
   * // Disable monitoring temporarily
   * fluxManager.setEnabled(false);
   * 
   * // Re-enable monitoring
   * fluxManager.setEnabled(true);
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Clear all stored request data
   * 
   * Removes all captured requests from memory storage and broadcasts
   * the update to connected WebSocket clients.
   * 
   * @returns {void}
   * 
   * @example
   * // Clear all monitoring data
   * fluxManager.clearRequests();
   */
  clearRequests() {
    this.storage.clear();
  }

  /**
   * Get all stored request data
   * 
   * Returns an array of all captured HTTP requests with their associated
   * response data, timestamps, and performance metrics.
   * 
   * @returns {Object[]} Array of request objects
   * 
   * @example
   * const requests = fluxManager.getRequests();
   * console.log(`Total requests: ${requests.length}`);
   * 
   * @example
   * // Filter requests by method
   * const postRequests = fluxManager.getRequests()
   *   .filter(req => req.method === 'POST');
   */
  getRequests() {
    return this.storage.getAll();
  }

  /**
   * 🔗 EXPRESS.JS Integration - Middleware pattern
   */
  expressMiddleware() {
    return (req, res, next) => {
      this.intercept(req, res, next);
    };
  }

  /**
   * 🔗 KOA.JS Integration - Async middleware pattern
   */
  koaMiddleware() {
    return async (ctx, next) => {
      this.intercept(ctx.req, ctx.res);
      await next();
    };
  }

  /**
   * 🔗 FASTIFY Integration - Hook pattern
   */
  fastifyHook(fastify) {
    fastify.addHook('onRequest', (request, reply, done) => {
      this.intercept(request.raw, reply.raw);
      done();
    });
  }

  /**
   * 🔗 NATIVE HTTP Integration - Server wrapper
   */
  wrapHttpServer(server) {
    const originalEmit = server.emit;
    const self = this;
    
    server.emit = function(event, req, res) {
      if (event === 'request') {
        self.intercept(req, res);
      }
      return originalEmit.apply(this, arguments);
    };
    
    return server;
  }

  /**
   * 🚀 UNIVERSAL INTEGRATION - Works with any framework
   * Auto-detects framework and applies appropriate integration
   */
  attachTo(app, options = {}) {
    // Merge options
    Object.assign(this.options, options);
    
    // Auto-detect framework and integrate
    if (app && typeof app.use === 'function') {
      // Express-like framework
      
      // 🔧 SAME-PORT FIX: Add dashboard routes as Express middleware
      // This ensures dashboard works even with complex middleware stacks and 404 handlers
      app.use(this.options.route, (req, res, next) => {
        // Handle dashboard UI routes
        if (req.path === '/' || req.path === '') {
          return this._serveDynamicHTML(res);
        }
        
        // Handle API routes
        if (req.path.startsWith('/api/')) {
          return this._handleAPIRequest(req, res);
        }
        
        // Handle static assets (app.js, styles.css)
        if (req.path === '/app.js' || req.path === '/styles.css') {
          const filePath = req.path.substring(1); // Remove leading slash
          return this._serveFile(res, filePath, this._getContentType(filePath));
        }
        
        // Handle WebSocket upgrade requests
        if (req.path === '/ws') {
          // WebSocket will be handled by the WebSocket server
          return next();
        }
        
        // If no FluxManager route matched, continue to next middleware
        next();
      });
      
      // Add monitoring middleware
      app.use(this.expressMiddleware());
      console.log('✅ Flux Manager attached to Express-like framework');
    } else if (app && typeof app.addHook === 'function') {
      // Fastify
      this.fastifyHook(app);
      console.log('✅ Flux Manager attached to Fastify');
    } else if (app && typeof app.emit === 'function') {
      // Native HTTP server
      this.wrapHttpServer(app);
      console.log('✅ Flux Manager attached to native HTTP server');
    } else {
      console.warn('⚠️  Framework not auto-detected. Use specific integration methods.');
    }
    
    console.log(`🔍 Flux Manager dashboard: http://localhost:${this.options.port}${this.options.route}`);
    return this;
  }

  /**
   * ✨ ULTRA-SIMPLE INTEGRATION - One line setup!
   * Creates standalone Flux Manager with optional app integration
   * 
   * @param {Object|null} app - Express app instance or null for standalone
   * @param {Object} options - Configuration options
   * @returns {FluxManager} FluxManager instance
   */
  static attach(app = null, options = {}) {
    // 🔧 SAME-PORT DETECTION: If app is provided and port matches app's port,
    // disable autoStart to prevent port conflicts
    let fluxManagerOptions = { ...options };
    
    if (app && typeof app.use === 'function') {
      // For Express-like frameworks with same-port integration
      // Disable auto-start to prevent creating separate HTTP server
      fluxManagerOptions.autoStart = false;
    }
    
    const fluxManager = new FluxManager(fluxManagerOptions);
    
    if (app) {
      fluxManager.attachTo(app, options);
    }
    
    return fluxManager;
  }

  /**
   * Stop the built-in server
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('Flux Manager server stopped');
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export default FluxManager;
