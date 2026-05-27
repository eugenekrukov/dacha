module.exports = {
  apps: [{
    name: 'dacha-api',
    script: 'src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'development',
      PORT: 3002
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/var/log/pm2/dacha-api-error.log',
    out_file:   '/var/log/pm2/dacha-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
