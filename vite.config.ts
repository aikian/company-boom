import { defineConfig } from 'vite';

// The game is served under sub.uxo.kr/boomcompany; override with BASE_PATH=/ for a root deployment.
export const base = process.env.BASE_PATH || '/boomcompany/';

// `npm start` (PORT=8787 DATA_DIR=.data) serves the leaderboard API locally; the dev server proxies to it.
export default defineConfig({ base, build: { chunkSizeWarningLimit: 600 }, server: { proxy: { [`${base}api`]: 'http://localhost:8787' } } });
