module.exports = {
  apps: [
    {
      name: 'pegasus-nest-api',
      script: 'dist/main.js',
      // Use limited instances in Docker to avoid resource conflicts
      instances:
        process.env.PM2_INSTANCES ||
        (process.env.NODE_ENV === 'production' ? 4 : 1),
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

      // Performance and monitoring - Docker optimized
      node_args: '--expose-gc --max-old-space-size=1024',
      max_memory_restart: '800M',
      min_uptime: '10s',
      max_restarts: 5,

      // Logging - Docker-friendly
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // Auto restart conditions
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'generated'],

      // Process management - simplified for containers
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: true,

      // Restart strategies
      restart_delay: 1000,
      autorestart: true,
      stop_exit_codes: [0],

      // Advanced settings
      time: true,
      source_map_support: true,

      // Disable health check as it's causing issues in Docker
      // health_check_http: 'http://localhost:3000/health',
      // health_check_grace_period: 3000,

      // Custom metrics and monitoring
      pmx: false, // Disable to reduce overhead in containers
      automation: false,

      // Graceful shutdown - simplified
      shutdown_with_message: true,
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
