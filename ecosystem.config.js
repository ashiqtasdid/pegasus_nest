module.exports = {
  apps: [
    {
      name: 'pegasus-nest-api',
      script: 'dist/main.js',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1, // Use all CPU cores in production, single instance in dev
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        MEMORY_MONITORING_ENABLED: 'true',
        PERFORMANCE_TRACKING_ENABLED: 'true',
        DATABASE_POOLING_ENABLED: 'true',
        STREAMING_ENABLED: 'true',
      },

      // Performance and monitoring - optimized for Docker
      node_args:
        process.env.NODE_ENV === 'production'
          ? '--expose-gc --max-old-space-size=1024'
          : '--expose-gc --max-old-space-size=2048',
      max_memory_restart: process.env.NODE_ENV === 'production' ? '800M' : '1G',
      min_uptime: '10s',
      max_restarts: 10,

      // Logging - Docker-friendly
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // Structured logging for Docker

      // Auto restart conditions
      watch: false, // Always disable in containerized environments
      ignore_watch: ['node_modules', 'logs', 'generated'],

      // Health monitoring - use comprehensive endpoint
      health_check_http: 'http://localhost:3000/health/detailed',
      health_check_grace_period: 5000,

      // Process management - Docker optimized
      kill_timeout: 10000, // Give more time for graceful shutdown in containers
      listen_timeout: 5000,
      wait_ready: true, // Wait for app to be ready before considering it online

      // Restart strategies
      restart_delay: 2000,
      autorestart: true,
      stop_exit_codes: [0], // Only auto-restart on unexpected exits

      // Advanced settings
      time: true,
      source_map_support: true,

      // Custom metrics and monitoring
      pmx: true,
      automation: false,

      // Graceful shutdown
      shutdown_with_message: true,
      wait_ready: true,
      listen_timeout: 3000,
      kill_timeout: 5000,
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/pegasus-nest.git',
      path: '/var/www/pegasus-nest',
      'pre-deploy-local': '',
      'post-deploy':
        'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};
