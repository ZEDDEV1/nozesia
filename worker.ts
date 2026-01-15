/**
 * BullMQ Worker Runner
 * 
 * Script standalone para rodar o worker de processamento de mensagens.
 * 
 * Uso:
 *   npm run worker
 * 
 * Com PM2:
 *   pm2 start npm --name "bullmq-worker" -- run worker
 *   pm2 save
 */

import "dotenv/config";
import { startWorker, stopWorker } from "./src/lib/message-worker";

console.log(`
╔════════════════════════════════════════════╗
║       BullMQ Message Worker                ║
║────────────────────────────────────────────║
║  Processing WhatsApp messages in background ║
╚════════════════════════════════════════════╝
`);

console.log("Environment:", process.env.NODE_ENV || "development");
console.log("Redis URL:", process.env.REDIS_URL || "redis://localhost:6379");
console.log("");

// Iniciar worker
startWorker();

console.log("✅ Worker started. Press Ctrl+C to stop.\n");

// Graceful shutdown
const shutdown = async () => {
    console.log("\n🛑 Shutting down worker...");
    await stopWorker();
    console.log("👋 Worker stopped. Goodbye!");
    process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
