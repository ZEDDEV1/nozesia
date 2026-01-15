/**
 * PM2 Ecosystem Configuration - LumusAI Production
 * 
 * Gerencia 3 processos:
 * 1. lumusai-app - Next.js + Socket.io
 * 2. lumusai-worker - BullMQ Worker
 * 3. lumusai-wpp - WPPConnect Server
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
    apps: [
        // ====================================
        // Next.js App + Socket.io
        // ====================================
        {
            name: 'lumusai-app',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            cwd: '/home/lumusai/htdocs/lumusai.com.br',
            instances: 1,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '0.0.0.0',
            },
            // Recursos
            max_memory_restart: '1G',
            min_uptime: '10s',
            max_restarts: 10,

            // Logs
            error_file: './logs/app-error.log',
            out_file: './logs/app-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,

            // Auto restart
            autorestart: true,
            watch: false,

            // Delay entre restarts
            restart_delay: 4000,
        },

        // ====================================
        // BullMQ Worker (Processamento de Mensagens)
        // ====================================
        {
            name: 'lumusai-worker',
            script: 'node_modules/.bin/tsx',
            args: 'worker.ts',
            cwd: '/home/lumusai/htdocs/lumusai.com.br',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
            },
            // Recursos
            max_memory_restart: '512M',
            min_uptime: '10s',
            max_restarts: 10,

            // Logs
            error_file: './logs/worker-error.log',
            out_file: './logs/worker-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,

            // Auto restart
            autorestart: true,
            watch: false,

            // Delay entre restarts
            restart_delay: 4000,
        },

        // ====================================
        // WPPConnect Server (WhatsApp)
        // ====================================
        {
            name: 'lumusai-wpp',
            script: 'server.js',
            cwd: '/home/lumusai/htdocs/lumusai.com.br/wppconnect-server',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 21465,
                WEBHOOK_URL: 'https://lumusai.com.br/api/whatsapp/webhook',
                SECRET_TOKEN: 'LUMUSAI_PRODUCTION_SECRET_2024',
            },
            // Recursos
            max_memory_restart: '768M',
            min_uptime: '10s',
            max_restarts: 10,

            // Logs
            error_file: '../logs/wpp-error.log',
            out_file: '../logs/wpp-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,

            // Auto restart
            autorestart: true,
            watch: false,

            // Delay entre restarts
            restart_delay: 4000,
        },
    ],

    // ====================================
    // Deploy Configuration (opcional)
    // ====================================
    deploy: {
        production: {
            user: 'lumusai',
            host: 'SEU_IP_VPS',
            ref: 'origin/main',
            repo: 'git@github.com:SEU_USUARIO/agentedeia.git',
            path: '/home/lumusai/htdocs/lumusai.com.br',
            'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js',
            env: {
                NODE_ENV: 'production',
            },
        },
    },
};
