import { defineConfig } from 'vite';

// The game is served under sub.uxo.kr/boomcompany; override with BASE_PATH=/ for a root deployment.
export const base = process.env.BASE_PATH || '/boomcompany/';

export default defineConfig({ base, build: { chunkSizeWarningLimit: 600 } });
