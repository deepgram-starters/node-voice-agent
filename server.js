/**
 * Node Voice Agent Starter - Backend Server
 *
 * Simple WebSocket proxy to Deepgram's Voice Agent API.
 * Forwards all messages (JSON and binary) bidirectionally between client and Deepgram.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import toml from 'toml';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  deepgramAgentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
  port: process.env.PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  vitePort: process.env.VITE_PORT || 5173,
  isDevelopment: process.env.NODE_ENV === 'development',
};

// Validate required environment variables
if (!CONFIG.deepgramApiKey) {
  console.error('Error: DEEPGRAM_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize Express
const app = express();
app.use(express.json());

// ============================================================================
// API ROUTES
// ============================================================================

// Metadata endpoint - returns info from deepgram.toml
app.get('/metadata', (req, res) => {
  try {
    const tomlPath = path.join(__dirname, 'deepgram.toml');
    const tomlContent = fs.readFileSync(tomlPath, 'utf-8');
    const config = toml.parse(tomlContent);

    if (!config.meta) {
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Missing [meta] section in deepgram.toml'
      });
    }

    res.json(config.meta);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to read metadata from deepgram.toml'
    });
  }
});

// Create HTTP server BEFORE setting up routes
// This allows us to intercept WebSocket upgrades at the server level
const server = createServer(app);

// ============================================================================
// FRONTEND SERVING (Development vs Production Pattern)
// ============================================================================
//
// This pattern allows framework-agnostic frontend/backend integration:
//
// DEVELOPMENT MODE (NODE_ENV=development):
//   - Vite dev server runs independently on port 5173 (or VITE_PORT)
//   - Backend proxies ALL requests to Vite for HMR and fast refresh
//   - Vite proxies API routes (/agent, /metadata) back to backend
//   - User accesses: http://localhost:8080
//   - Flow: User → :8080 (Backend) → :5173 (Vite) → [API requests back to :8080]
//
// PRODUCTION MODE (NODE_ENV=production or default):
//   - Frontend is pre-built (npm run build) to frontend/dist
//   - Backend serves static files directly from frontend/dist
//   - Backend handles API routes directly
//   - User accesses: http://localhost:8080
//   - Flow: User → :8080 (Backend serves static + APIs)
//
// REPLICATION FOR OTHER FRAMEWORKS:
//   Flask:     Use flask.send_from_directory() for static, requests.get() for proxy
//   Django:    Use django.views.static.serve() for static, HttpResponse(requests.get()) for proxy
//   Go:        Use http.FileServer() for static, httputil.NewSingleHostReverseProxy() for proxy
//   .NET:      Use app.UseStaticFiles() for static, app.UseProxy() for proxy
//
// ============================================================================

if (CONFIG.isDevelopment) {
  console.log(`Development mode: Proxying to Vite dev server on port ${CONFIG.vitePort}`);

  // Create proxy middleware for HTTP requests only (no WebSocket)
  const viteProxy = createProxyMiddleware({
    target: `http://localhost:${CONFIG.vitePort}`,
    changeOrigin: true,
    ws: false, // Disable automatic WebSocket proxying - we'll handle it manually
  });

  app.use('/', viteProxy);

  // Manually handle WebSocket upgrades at the server level
  // This allows us to selectively proxy based on path
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    console.log(`WebSocket upgrade request for: ${pathname}`);

    // Backend handles /agent WebSocket connections directly
    // The WebSocketServer below will handle these
    if (pathname.startsWith('/agent')) {
      console.log('Backend handling /agent WebSocket');
      // Don't do anything - let the WebSocketServer handle it
      return;
    }

    // Forward all other WebSocket connections (Vite HMR) to Vite
    console.log('Proxying WebSocket to Vite');
    viteProxy.upgrade(request, socket, head);
  });
} else {
  console.log('Production mode: Serving static files from frontend/dist');
  const distPath = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(distPath));
}

// Create WebSocket server for agent endpoint
const wss = new WebSocketServer({
  server,
  path: '/agent/converse'
});

// Handle WebSocket connections - simple pass-through proxy
wss.on('connection', async (clientWs, request) => {
  console.log('Client connected to /agent/converse');

  try {
    // Extract API key from Sec-WebSocket-Protocol header or use server's key
    const protocol = request.headers['sec-websocket-protocol'];
    const apiKey = protocol || CONFIG.deepgramApiKey;

    if (!apiKey) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: 'Missing API key',
        code: 'MISSING_API_KEY'
      }));
      clientWs.close();
      return;
    }

    // Create raw WebSocket connection to Deepgram Agent API
    // Send API key via Authorization header
    const deepgramWs = new WebSocket(CONFIG.deepgramAgentUrl, {
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    // Forward all messages from Deepgram to client
    deepgramWs.on('open', () => {
      console.log('Connected to Deepgram Agent API');
    });

    deepgramWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    deepgramWs.on('error', (error) => {
      console.error('Deepgram WebSocket error:', error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'Error',
          description: error.message || 'Deepgram connection error',
          code: 'PROVIDER_ERROR'
        }));
      }
    });

    deepgramWs.on('close', (code, reason) => {
      console.log(`Deepgram connection closed: ${code} ${reason}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        // Use valid close code or default to 1000
        // Reserved codes (1004, 1005, 1006, 1015) cannot be set by application
        const reservedCodes = [1004, 1005, 1006, 1015];
        const closeCode = (typeof code === 'number' && code >= 1000 && code <= 4999 && !reservedCodes.includes(code)) ? code : 1000;
        clientWs.close(closeCode, reason);
      }
    });

    // Forward all messages from client to Deepgram
    clientWs.on('message', (data, isBinary) => {
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(data, { binary: isBinary });
      }
    });

    // Handle client disconnect
    clientWs.on('close', (code, reason) => {
      console.log(`Client disconnected: ${code} ${reason}`);
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.close();
      }
    });

    // Handle client errors
    clientWs.on('error', (error) => {
      console.error('Client WebSocket error:', error);
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.close();
      }
    });

  } catch (error) {
    console.error('Error setting up proxy:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'Error',
        description: 'Failed to establish proxy connection',
        code: 'CONNECTION_FAILED'
      }));
      clientWs.close();
    }
  }
});

// Start the server
server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Server running at http://localhost:${CONFIG.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${CONFIG.port}/agent/converse`);
  console.log(`Metadata endpoint: http://localhost:${CONFIG.port}/metadata`);
  if (CONFIG.isDevelopment) {
    console.log(`Make sure Vite dev server is running on port ${CONFIG.vitePort}`);
    console.log(`\n⚠️  Open your browser to http://localhost:${CONFIG.port}`);
  }
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down server...');

  wss.clients.forEach((client) => {
    try {
      client.close();
    } catch (err) {
      console.error('Error closing client:', err);
    }
  });

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('Force closing');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
