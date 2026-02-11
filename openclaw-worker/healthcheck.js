/**
 * Healthcheck simple pour Railway
 * Vérifie que le serveur répond sur /health
 */

import http from 'http';

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('[Healthcheck] ✅ OK');
    process.exit(0);
  } else {
    console.log(`[Healthcheck] ❌ Status: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.log('[Healthcheck] ❌ Error:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.log('[Healthcheck] ❌ Timeout');
  request.destroy();
  process.exit(1);
});

request.end();
