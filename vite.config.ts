import { defineConfig } from 'vite';

// The game is served under sub.uxo.kr/boomcompany; override with BASE_PATH=/ for a root deployment.
export const base = process.env.BASE_PATH || '/boomcompany/';

// `npm start` (PORT=8787 DATA_DIR=.data) serves the leaderboard API locally; the dev server proxies to it.
const version = `${process.env.npm_package_version || '0.0.0'}+${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-T:]/g, '').replace(/(\d{8})(\d{4})/, '$1.$2')}`;

export default defineConfig({ base, define: { __APP_VERSION__: JSON.stringify(version) }, build: { chunkSizeWarningLimit: 600 }, server: { proxy: { [`${base}api`]: 'http://localhost:8787' } } });
