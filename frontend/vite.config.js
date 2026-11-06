import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the same build works from file:// (Electron) and Capacitor's local server.
export default defineConfig({ base: './', plugins: [react()], server: { port: 5173 } });
