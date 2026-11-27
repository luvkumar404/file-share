# Frontend

React/Vite frontend for Secure File Sharing. See the [project README](../README.md) for development, production deployment, environment variables, and verification.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
```

Development uses `http://localhost:8000`; production defaults to `/api`. `VITE_API_BASE_URL` overrides the API address at build time. The production Docker image serves the build with Nginx and proxies `/api` to the backend, with SPA routing and security headers.
