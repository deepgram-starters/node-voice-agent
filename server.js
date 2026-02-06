/**
 * Node Voice Agent Starter - Backend Server
 *
 * Simple WebSocket proxy to Deepgram's Voice Agent API.
 * Forwards all messages (JSON and binary) bidirectionally between client and Deepgram.
 * CORS-enabled for frontend communication.
 */

const { WebSocketServer, WebSocket } = require('ws');
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const toml = require('toml');
// Native __dirname support in CommonJS

// Configuration
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  deepgramAgentUrl: 'wss://agent.deepgram.com/v1/agent/converse',
  port: process.env.PORT || 8081,
  host: process.env.HOST || '0.0.0.0',
  frontendPort: process.env.FRONTEND_PORT || 8080,
};

// Validate required environment variables
if (!CONFIG.deepgramApiKey) {
  console.error('Error: DEEPGRAM_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize Express
const app = express();
app.use(express.json());

// Enable CORS for frontend
app.use(cors({
  origin: [
    `http://localhost:${CONFIG.frontendPort}`,
    `http://127.0.0.1:${CONFIG.frontendPort}`
  ],
  credentials: true
}));

// ============================================================================
// API ROUTES
// ============================================================================

// Metadata endpoint - required for standardization compliance
app.get('/api/metadata', (req, res) => {
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

// Create HTTP server
const server = createServer(app);

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
    console.log('Initiating Deepgram connection...');
    const deepgramWs = new WebSocket(CONFIG.deepgramAgentUrl, {
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    // Forward all messages from Deepgram to client
    deepgramWs.on('open', () => {
      console.log('✓ Connected to Deepgram Agent API');
      // Deepgram sends Welcome message automatically - just forward it
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
  console.log('');
  console.log('======================================================================');
  console.log(`🚀 Backend API Server running at http://localhost:${CONFIG.port}`);
  console.log(`📡 CORS enabled for http://localhost:${CONFIG.frontendPort}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${CONFIG.port}/agent/converse`);
  console.log('');
  console.log(`💡 Frontend should be running on http://localhost:${CONFIG.frontendPort}`);
  console.log('======================================================================');
  console.log('');
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
