/**
 * PM2 Ecosystem Configuration - NozesIA Production
 * 
 * Gerencia 3 processos:
 * 1. nozesia-app - Next.js + Socket.io (usando server.ts customizado)
 * 2. nozesia-worker - BullMQ Worker
 * 3. nozesia-wpp - WPPConnect Server
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
    apps: [
        // ====================================
        // Next.js App + Socket.io (Servidor Customizado)
        // ====================================
        {
            name: 'nozesia-app',
            // IMPORTANTE: Usa server.ts que inicializa Socket.io
            script: 'node_modules/.bin/tsx',
            args: 'server.ts',
            cwd: '/home/nozesia/htdocs/nozesia.pro',
            instances: 1,
            exec_mode: 'fork', // Fork mode para Socket.io funcionar corretamente
            env: {
                NODE_ENV: 'production',
                PORT: 3004,
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
            name: 'nozesia-worker',
            script: 'node_modules/.bin/tsx',
            args: 'worker.ts',
            cwd: '/home/nozesia/htdocs/nozesia.pro',
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
            name: 'nozesia-wpp',
            script: 'server.js',
            cwd: '/home/nozesia/htdocs/nozesia.pro/wppconnect-server',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 21466,
                WEBHOOK_URL: 'https://nozesia.pro/api/whatsapp/webhook',
                SECRET_TOKEN: 'NOZESIA_SECRET_2024',
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
};
