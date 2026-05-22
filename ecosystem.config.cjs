/**
 * PM2 — MatuMailer en producción
 * 1. Edita APP_DIR si clonaste en otra ruta
 * 2. pm2 start ecosystem.config.cjs
 * 3. pm2 save
 */
const APP_DIR = '/var/www/matumailer';

module.exports = {
  apps: [
    {
      name: 'matumailer-api',
      cwd: APP_DIR,
      script: 'apps/api/dist/index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
      },
    },
    {
      name: 'matumailer-dashboard',
      cwd: `${APP_DIR}/apps/dashboard`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3015 -H 0.0.0.0',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
