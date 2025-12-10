import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/golf': {
        target: 'https://www.golfapi.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Rewrite /api/golf/courses/:id to /api/v2.3/courses/:id
          return path.replace(/^\/api\/golf/, '/api/v2.3');
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Remove Content-Type header if present (GET requests don't need it)
            if (proxyReq.getHeader('content-type')) {
              proxyReq.removeHeader('content-type');
            }
            // Add headers to make request look like it's from a browser
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Referer', 'https://www.golfapi.io/');
            proxyReq.setHeader('Origin', 'https://www.golfapi.io');
            proxyReq.setHeader('Authorization', 'Bearer d75f6880-c25f-45f4-91b0-424de3b14c3e');
          });
        },
      },
    },
  },
})
