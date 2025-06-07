module.exports = {
  apps: [
    {
      name: 'pegasus-nest-api',
      script: 'dist/main.js',
      // Single instance for Docker reliability
      instances: 1,
      exec_mode: 'fork',

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

      // Performance settings - conservative for containers
      node_args: '--expose-gc --max-old-space-size=1024',
      max_memory_restart: '900M',
      min_uptime: '5s',
      max_restarts: 3,

      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // Disable watch and complex features for containers
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'generated'],

      // Simple process management for Docker
      kill_timeout: 3000,
      listen_timeout: 8000,
      wait_ready: true,

      // Restart configuration
      restart_delay: 500,
      autorestart: true,
      stop_exit_codes: [0],

      // Minimal settings for stability
      time: true,
      source_map_support: false,
      pmx: false,
      automation: false,

      // Graceful shutdown
      shutdown_with_message: true,
    },
  ],
};
