module.exports = {
  apps: [
    {
      name: 'churchhub-backend',
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      merge_logs: true,
      autorestart: true,
      watch: false,
    },
  ],
};
