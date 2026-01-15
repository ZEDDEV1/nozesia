/**
 * Custom Server with Socket.io
 * 
 * Este servidor customizado inicializa Next.js com Socket.io integrado.
 * 
 * IMPORTANTE: Use com webpack, não Turbopack
 * 
 * Para usar em desenvolvimento:
 * npm run dev:socket
 * 
 * Para produção:
 * npm run build && npm run start:socket
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./src/lib/socket-server";

import { emitNewMessage, emitNewConversation } from "./src/lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Criar app Next.js - Desabilitar Turbopack para compatibilidade
const app = next({
    dev,
    hostname,
    port,
    // Turbopack não funciona bem com servidor customizado
    // turbopack: false, // Esta opção não existe, vamos usar outro método
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
    // Criar servidor HTTP
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);

            // Internal emit endpoint - usado pelo webhook para emitir eventos
            if (parsedUrl.pathname === "/_internal/emit" && req.method === "POST") {
                let body = "";
                req.on("data", chunk => { body += chunk; });
                req.on("end", () => {
                    try {
                        const data = JSON.parse(body);

                        if (data.type === "message") {
                            emitNewMessage(data.conversationId, data.companyId, data.message);
                            console.log("[InternalEmit] Message emitted", { conversationId: data.conversationId });
                        } else if (data.type === "conversation") {
                            emitNewConversation(data.companyId, data.conversation);
                            console.log("[InternalEmit] Conversation emitted", { conversationId: data.conversation?.id });
                        }

                        res.statusCode = 200;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true }));
                    } catch (err) {
                        console.error("[InternalEmit] Error:", err);
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: "Invalid request" }));
                    }
                });
                return;
            }

            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error handling request:", err);
            res.statusCode = 500;
            res.end("Internal Server Error");
        }
    });

    // Inicializar Socket.io
    initSocketServer(httpServer);

    // Iniciar servidor
    httpServer.listen(port, () => {
        console.log(`
🚀 Server ready!
   
   Local:    http://${hostname}:${port}
   Socket:   ws://${hostname}:${port}
   
   Mode:     ${dev ? "Development" : "Production"}
   
   ⚠️  Se der erro, use: npm run dev (sem WebSocket)
        `);
    });
});
