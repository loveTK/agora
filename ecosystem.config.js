module.exports = {
  apps: [
    {
      name: "agora-api",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      out_file: "/home/ubuntu/.pm2/logs/agora-out.log",
      error_file: "/home/ubuntu/.pm2/logs/agora-error.log",
    },
  ],
};
