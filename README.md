# 🚀 Flux Manager

> A powerful, framework-agnostic Node.js debugging tool for real-time HTTP request monitoring

![Flux Manager](https://img.shields.io/badge/Flux-Manager-9333ea?style=for-the-badge&logo=node.js&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-9333ea?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-9333ea?style=for-the-badge)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-9333ea?style=for-the-badge)
![ES6](https://img.shields.io/badge/ES6-modules-9333ea?style=for-the-badge)

Flux Manager is a comprehensive Node.js application monitoring and debugging platform. It provides real-time HTTP request tracking, supporting **any Node.js HTTP framework** including Express, Koa, Fastify, and native HTTP servers.


## 📦 Installation

```bash
npm install flux-manager
```

## 🚀 Quick Start

### ✨ Ultra-Simple Integration (One Line!)

```javascript
import express from 'express';
import FluxManager from 'flux-manager';

const app = express();

// 🎯 ONE LINE SETUP - Auto-detects framework and integrates!
const fluxManager = FluxManager.attach(app, {
  route: '/flux-manager',
  port: 3000,         
  maxRequests: 1000
});

// Your application runs on port 3000
app.listen(3000, () => {
  console.log('✅ Your app: http://localhost:3000');
  console.log('🔍 FluxManager dashboard: http://localhost:3000/flux-manager');
});

```

### Koa.js Integration

```javascript
import Koa from 'koa';
import FluxManager from 'flux-manager';

const app = new Koa();

// Auto-attach to Koa
const fluxManager = FluxManager.attach(app, { route: '/flux-manager' });

app.listen(3000);
```

### Fastify Integration

```javascript
import Fastify from 'fastify';
import FluxManager from 'flux-manager';

const fastify = Fastify();

// Auto-attach to Fastify
const fluxManager = FluxManager.attach(fastify, { route: '/flux-manager' });

fastify.listen({ port: 3000 });
```

### Native HTTP Server

```javascript
import http from 'http';
import FluxManager from 'flux-manager';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

// Auto-attach to HTTP server
const fluxManager = FluxManager.attach(server, { route: '/flux-manager' });

server.listen(3000);
```


### **📍 Access Points:**

| Service | URL | Purpose |
|---------|-----|----------|
| **Your Application** | `http://localhost:3000` | Your main app, API endpoints, web pages |
| **FluxManager Dashboard** | `http://localhost:3000/flux-manager` | Monitoring dashboard, request inspection |
| **WebSocket Connection** | `ws://localhost:3000/flux-manager/ws` | Real-time updates for dashboard |

### **⚙️ Port Configuration Options:**

```javascript
// Option 1: Same port (Recommended - Simple Setup)
const fluxManager = FluxManager.attach(app, {
  port: 3000,     // FluxManager uses same port as your app
  route: '/flux-manager'
});
app.listen(3000);
// Access: http://localhost:3000/flux-manager

// Option 2: Separate ports (Advanced - Better Isolation)
const fluxManager = FluxManager.attach(app, {
  port: 3001,     // FluxManager runs on separate port
  route: '/flux-manager'
});
app.listen(3000); // Your app runs on port 3000
// Access: http://localhost:3001/flux-manager

// Option 3: Standalone mode
const fluxManager = FluxManager.attach(null, {
  port: 3001,     // FluxManager runs independently
  route: '/flux-manager'
});
// Access: http://localhost:3001/flux-manager
```

## ⚙️ Configuration Options

```javascript
const fluxManager = new FluxManager({
  // Dashboard route (default: '/flux-manager')
  route: '/debug',
  
  // server port (default: 3001)
  port: 3001,
  
  // Maximum stored requests (default: 1000)
  maxRequests: 500,
  
  // Enable/disable WebSocket (default: true)
  enableWebSocket: true,
  
  // Auto-start servers (default: true)
  autoStart: true
});
```

## 🛡️ Security Considerations

### Production Deployment

⚠️ **Important**: Flux Manager captures complete request/response data including headers and bodies. Consider these security implications:

1. **Sensitive Data**: Request/response bodies may contain sensitive information
2. **Authentication**: No built-in authentication - secure the debugger route
3. **Memory Usage**: In-memory storage grows with request volume
4. **Network Exposure**: WebSocket connections should be secured


## 🚀 Performance Optimization

### Memory Management
- **Circular Buffer**: Automatically removes old requests when limit is reached
- **Configurable Limits**: Adjust `maxRequests` based on available memory
- **Efficient Filtering**: In-memory filtering with minimal overhead

### Network Optimization
- **Pagination**: API responses are paginated to reduce payload size
- **WebSocket Compression**: Automatic compression for real-time updates
- **Static Asset Caching**: Frontend assets served with appropriate cache headers

### Monitoring Recommendations
```javascript
// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 30000);
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Setup

```bash
# Clone the repository
git clone https://github.com/thejesbin/flux-manager.git
cd flux-manager

# Install dependencies
npm install
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

**Made with 💜 by the Flux Manager Team**

For questions, issues, or feature requests, please visit our [GitHub repository](https://github.com/thejesbin/flux-manager).
