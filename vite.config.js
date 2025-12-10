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
            // Add Authorization header
            proxyReq.setHeader('Authorization', 'Bearer d75f6880-c25f-45f4-91b0-424de3b14c3e');
          });
        },
      },
    },
  },
})
