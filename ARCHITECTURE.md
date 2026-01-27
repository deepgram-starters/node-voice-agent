# Frontend/Backend Integration Pattern

This document describes the architecture pattern used across Deepgram starter applications for integrating frontend and backend services.

## Overview

All starter applications use a **unified port pattern** where users access everything through a single backend port (typically 8080). The pattern differs between development and production modes to optimize for developer experience and production performance.

## The Pattern

### Development Mode

```
┌─────────┐         ┌──────────┐         ┌──────────────┐
│ Browser │ ───────▶│ Backend  │ ───────▶│ Vite Dev     │
│         │         │ :8080    │         │ Server :5173 │
└─────────┘         └──────────┘         └──────────────┘
                          ▲                      │
                          │  API Requests (/api) │
                          └──────────────────────┘
```

**Flow:**
1. User accesses `http://localhost:8080`
2. Backend proxies ALL requests to Vite dev server on port 5173
3. Vite provides hot module replacement (HMR) and serves frontend
4. Vite proxies API routes back to backend on port 8080
5. Backend handles API/WebSocket requests and returns responses

**Benefits:**
- Single URL for developers (no CORS issues)
- Hot module replacement works seamlessly
- API routes handled by backend
- Fast frontend development with Vite

### Production Mode

```
┌─────────┐         ┌──────────────────────┐
│ Browser │ ───────▶│ Backend :8080        │
│         │         │                      │
│         │         │ ├─ Static Files      │
│         │         │ └─ API Routes        │
└─────────┘         └──────────────────────┘
```

**Flow:**
1. User accesses `http://localhost:8080`
2. Backend serves pre-built static files from `frontend/dist`
3. Backend handles API/WebSocket requests directly
4. No additional processes required

**Benefits:**
- Simple deployment (single process)
- Optimized static file serving
- No development dependencies needed

## Implementation by Framework

### Node.js (Express)

```javascript
// Check environment
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Proxy to Vite dev server
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true  // For HMR WebSocket
  }));
} else {
  // Serve static files
  app.use(express.static('frontend/dist'));
}
```

### Python (Flask)

```python
import os
import requests
from flask import Flask, send_from_directory

app = Flask(__name__)
is_dev = os.getenv('NODE_ENV') == 'development'

if is_dev:
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def proxy(path):
        # Proxy to Vite
        resp = requests.get(f'http://localhost:5173/{path}')
        return resp.content, resp.status_code
else:
    @app.route('/', defaults={'path': 'index.html'})
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory('frontend/dist', path)
```

### Python (Django)

```python
# settings.py
DEBUG = os.getenv('NODE_ENV') == 'development'
VITE_DEV_SERVER_URL = 'http://localhost:5173'

# views.py
from django.views.static import serve
from django.http import HttpResponse
import requests

def frontend_view(request, path=''):
    if settings.DEBUG:
        # Proxy to Vite
        url = f'{settings.VITE_DEV_SERVER_URL}/{path}'
        resp = requests.get(url)
        return HttpResponse(resp.content, status=resp.status_code)
    else:
        # Serve static files
        return serve(request, path, document_root='frontend/dist')
```

### Go

```go
package main

import (
    "net/http"
    "net/http/httputil"
    "net/url"
    "os"
)

func main() {
    isDev := os.Getenv("NODE_ENV") == "development"

    if isDev {
        // Proxy to Vite
        viteURL, _ := url.Parse("http://localhost:5173")
        proxy := httputil.NewSingleHostReverseProxy(viteURL)
        http.Handle("/", proxy)
    } else {
        // Serve static files
        fs := http.FileServer(http.Dir("frontend/dist"))
        http.Handle("/", fs)
    }

    http.ListenAndServe(":8080", nil)
}
```

### .NET (ASP.NET Core)

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var isDev = app.Environment.IsDevelopment();

if (isDev)
{
    // Proxy to Vite
    app.UseProxy(new Uri("http://localhost:5173"));
}
else
{
    // Serve static files
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            Path.Combine(Directory.GetCurrentDirectory(), "frontend", "dist"))
    });
}

app.Run();
```

### Ruby (Sinatra)

```ruby
require 'sinatra'
require 'net/http'

configure do
  set :is_dev, ENV['NODE_ENV'] == 'development'
end

if settings.is_dev
  # Proxy to Vite
  get '*' do
    uri = URI("http://localhost:5173#{request.path}")
    response = Net::HTTP.get_response(uri)
    response.body
  end
else
  # Serve static files
  set :public_folder, 'frontend/dist'
end
```

## Frontend Configuration (Vite)

The frontend must proxy API routes back to the backend in development mode:

```javascript
// vite.config.js
export default defineConfig({
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
    proxy: {
      '/api': 'http://localhost:8080',
      '/metadata': 'http://localhost:8080',
      '/agent': {
        target: 'http://localhost:8080',
        ws: true  // For WebSocket routes
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
```

## Environment Variables

Standard environment variables across all frameworks:

```bash
# Development vs Production mode
NODE_ENV=development          # 'development' or 'production'

# Backend server configuration
PORT=8080                     # Backend port
HOST=0.0.0.0                  # Backend host

# Vite dev server configuration (dev mode only)
VITE_PORT=5173               # Vite port
```

## Build Process

### Development
```bash
# Start backend (with proxy to Vite)
NODE_ENV=development npm start

# Start Vite dev server (in another terminal)
cd frontend && npm run dev
```

### Production
```bash
# Build frontend
cd frontend && npm run build

# Start backend (serves static files)
npm start
```

## Testing the Setup

1. **Development mode**: Access http://localhost:8080
   - Changes to frontend files should trigger HMR
   - API requests should work without CORS issues
   - Check browser console for Vite connection

2. **Production mode**: Build and access http://localhost:8080
   - Should serve optimized, bundled files
   - No Vite process should be running
   - Check Network tab for minified assets

## Benefits of This Pattern

1. **Developer Experience**: Single URL, no CORS issues, HMR works
2. **Framework Agnostic**: Can be implemented in any backend language
3. **Simple Deployment**: Single process in production
4. **Future-Proof**: Frontend can be moved to submodule without changes
5. **Consistent**: Same pattern across all Deepgram starters

## Common Pitfalls

1. **Port Mismatch**: Ensure backend's `VITE_PORT` matches frontend's Vite config
2. **Missing Proxy**: Frontend must proxy API routes back to backend in dev mode
3. **WebSocket Support**: Remember to enable WebSocket proxying (ws: true)
4. **Build Output**: Ensure frontend builds to `dist` directory
5. **Environment Check**: Use `NODE_ENV=development` consistently

## Future: Git Submodules

When frontend is moved to a git submodule:
- This pattern continues to work unchanged
- Frontend remains in `frontend/` directory
- Same build and proxy configuration
- Single command to update: `git submodule update --remote`
