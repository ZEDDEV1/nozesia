const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const wppconnect = require('@wppconnect-team/wppconnect');
const axios = require('axios');

const app = express();
app.use(cors());
// Increase limit for audio base64 payloads (TTS can generate 200KB+ audio)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// =============================
// 🧠 Estrutura de sessões
// =============================
let sessions = {};

// =============================
// 🔒 Anti-abuso simples
// =============================
let lastSessionCreate = 0;

// Webhook URL para o Next.js
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/whatsapp/webhook';
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'AGENTEDEIA_SECRET_2024';

// =============================
// 🔧 Função auxiliar: anexar eventos em um client
// =============================
function attachClientEvents(session_name, client) {
    console.log(`>>> Eventos anexados para sessão ${session_name}`);

    const session = sessions[session_name];
    if (!session) return;

    session.client = client;
    session.status = 'CONNECTED';
    session.connected_at = Date.now();
    session.reconnecting = false;
    session.qr = null;

    client.onStateChange((state) => {
        console.log(`Estado da sessão ${session_name}:`, state);

        const badStates = [
            'DISCONNECTED',
            'UNPAIRED',
            'UNPAIRED_IDLE',
            'LOGOUT',
        ];

        if (badStates.includes(state)) {
            console.log(`>>> Sessão ${session_name} entrou em estado crítico (${state}). Marcando como DISCONNECTED.`);
            session.status = 'DISCONNECTED';
            session.qr = null;
            // Don't auto-reconnect to avoid browser conflicts
        } else if (state === 'CONNECTED') {
            session.status = 'CONNECTED';
        }
    });

    client.onMessage(async (message) => {
        try {
            console.log('\n====================================');
            console.log('📥 NOVA MENSAGEM RECEBIDA');
            console.log('====================================');
            console.log('🔹 From:', message.from);
            console.log('🔹 To:', message.to);
            console.log('🔹 Type:', message.type);
            console.log('🔹 IsMedia:', message.isMedia);
            console.log('🔹 Mimetype:', message.mimetype);

            // Get contact info for customer name
            let senderName = 'Cliente';
            try {
                const contact = await client.getContact(message.from);
                senderName = contact.pushname || contact.formattedName || contact.name || 'Cliente';
                console.log('🔹 Sender Name:', senderName);
            } catch (e) {
                console.log('Could not get contact:', e.message);
            }

            // Prepare payload
            let payload = {
                event: 'onmessage',
                session: session_name,
                from: message.from,
                to: message.to,
                body: message.body || '',
                type: message.type,
                isGroupMsg: message.isGroupMsg,
                isMedia: message.isMedia || false,
                mimetype: message.mimetype || null,
                sender: {
                    id: message.from,
                    pushname: senderName,
                },
            };

            // Handle media messages (audio, image, video, document)
            const mediaTypes = ['ptt', 'audio', 'image', 'video', 'document', 'sticker'];
            if (mediaTypes.includes(message.type) || message.isMedia || message.mimetype) {
                console.log('🎵 Baixando mídia...');
                try {
                    // Download media as base64
                    const mediaData = await client.decryptFile(message);
                    if (mediaData) {
                        const base64Data = mediaData.toString('base64');
                        const mimePrefix = message.mimetype || 'application/octet-stream';
                        payload.body = `data:${mimePrefix};base64,${base64Data}`;
                        payload.mediaData = {
                            mimetype: message.mimetype,
                            data: base64Data,
                            filename: message.filename || null,
                        };
                        console.log('✅ Mídia baixada com sucesso!', {
                            type: message.type,
                            mimetype: message.mimetype,
                            size: base64Data.length,
                        });
                    }
                } catch (mediaErr) {
                    console.error('❌ Erro ao baixar mídia:', mediaErr.message);
                    // Fallback: try to get base64 directly from message
                    if (message.body && message.body.startsWith('data:')) {
                        payload.body = message.body;
                        console.log('📦 Usando body como base64 fallback');
                    } else {
                        payload.body = `[${message.type.toUpperCase()} - Erro ao baixar]`;
                    }
                }
            }

            // Add caption for media with captions
            if (message.caption) {
                payload.caption = message.caption;
            }

            // Send to Next.js webhook
            console.log('📤 Enviando ao webhook...');
            await axios.post(WEBHOOK_URL, payload);

            console.log('✅ Mensagem enviada ao webhook');
        } catch (err) {
            console.error(`[Webhook] Erro ao enviar mensagem para Next.js:`, err.message);
        }
    });
}

// =============================
// 🔄 Função: iniciar sessão
// =============================
async function startSession(session_name) {
    if (!sessions[session_name]) {
        sessions[session_name] = {
            status: 'CREATING',
            qr: null,
            client: null,
            connected_at: null,
            last_check: Date.now(),
            reconnecting: false,
        };
    } else {
        sessions[session_name].status = 'CREATING';
        sessions[session_name].qr = null;
        sessions[session_name].connected_at = null;
    }

    console.log(`>>> Iniciando sessão ${session_name}...`);

    return wppconnect
        .create({
            session: session_name,
            catchQR: (base64Qr, asciiQR) => {
                console.log(`>>> QR atualizado para sessão ${session_name}`);
                if (!sessions[session_name]) return;
                sessions[session_name].qr = base64Qr;
                sessions[session_name].status = 'WAITING_QR';
            },
            autoClose: false,
            puppeteerOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-zygote',
                    '--no-first-run',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-infobars',
                ],
            },
        })
        .then((client) => {
            if (!sessions[session_name]) {
                sessions[session_name] = {};
            }
            console.log(`>>> Sessão ${session_name} iniciada com sucesso!`);
            attachClientEvents(session_name, client);
        })
        .catch((err) => {
            console.error(`Erro ao criar sessão ${session_name}:`, err);
            if (sessions[session_name]) {
                sessions[session_name].status = 'ERROR';
            }
        });
}

// ================================================
// 📌 API: Criar/Iniciar Sessão
// ================================================
app.post('/api/:session/start-session', async (req, res) => {
    const { session } = req.params;

    // Accept token from body or Authorization header
    let token = req.body.token;
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = SECRET_TOKEN;
    }

    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ status: 'error', message: 'Invalid token' });
    }

    if (!session) {
        return res.status(400).json({ status: 'error', message: 'Session name is required' });
    }

    if (Date.now() - lastSessionCreate < 3000) {
        return res.status(429).json({ status: 'error', message: 'Too many requests' });
    }
    lastSessionCreate = Date.now();

    const existing = sessions[session];

    if (existing && existing.status === 'CONNECTED' && existing.client) {
        return res.json({ status: 'success', message: 'Already connected' });
    }

    startSession(session);

    return res.json({ status: 'success', message: 'Session started' });
});

// ================================================
// 📌 API: Status da Sessão
// ================================================
app.get('/api/:session/check-connection-session', (req, res) => {
    const { session } = req.params;
    const sessionData = sessions[session];

    if (!sessionData) {
        return res.json({
            status: false,
            message: 'Not found',
            session,
        });
    }

    sessionData.last_check = Date.now();

    // Use !! to ensure we get a boolean, not the client object
    const isConnected = sessionData.status === 'CONNECTED' && !!sessionData.client;

    res.json({
        status: isConnected,
        message: isConnected ? 'Connected' : sessionData.status,
        session,
    });
});

// ================================================
// 📌 API: QR Code
// ================================================
app.get('/api/:session/qrcode-session', (req, res) => {
    const { session } = req.params;
    const sessionData = sessions[session];

    if (!sessionData || !sessionData.qr) {
        return res.json({ status: 'INITIALIZING', message: 'QRCode is not available...' });
    }

    // Send QR as base64 image
    const base64Data = sessionData.qr.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.send(imgBuffer);
});

// ================================================
// 📌 API: Enviar Mensagem de Texto
// ================================================
app.post('/api/:session/send-message', async (req, res) => {
    const { session } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            status: 'error',
            message: 'phone and message are required',
        });
    }

    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({
            status: 'Disconnected',
            message: 'A sessão do WhatsApp não está ativa.',
            session,
        });
    }

    // Use phone as-is - DO NOT convert @lid to @c.us
    // WhatsApp now uses LID format
    const to = phone;

    try {
        console.log(`>>> Enviando mensagem para ${to}...`);
        await sessionData.client.sendText(to, message);
        console.log('>>> Mensagem enviada com sucesso!');

        return res.json({
            status: 'success',
            message: 'Message sent',
        });
    } catch (err) {
        console.error(`Erro ao enviar mensagem para ${to}:`, err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

// ================================================
// 📌 API: Enviar Texto (endpoint alternativo)
// ================================================
app.post('/api/:session/send-text', async (req, res) => {
    const { session } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            status: 'error',
            message: 'phone and message are required',
        });
    }

    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({
            status: 'Disconnected',
            message: 'A sessão do WhatsApp não está ativa.',
            session,
        });
    }

    // Use phone as-is - DO NOT convert
    const to = phone;

    try {
        console.log(`>>> Enviando texto para ${to}...`);
        await sessionData.client.sendText(to, message);
        console.log('>>> Texto enviado com sucesso!');

        return res.json({
            status: 'success',
            message: 'Message sent',
        });
    } catch (err) {
        console.error(`Erro ao enviar texto para ${to}:`, err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

// ================================================
// 📌 API: Enviar Áudio/Voz (PTT - Push To Talk)
// ================================================
app.post('/api/:session/send-voice-base64', async (req, res) => {
    const { session } = req.params;
    const { phone, base64 } = req.body;

    if (!phone || !base64) {
        return res.status(400).json({
            status: 'error',
            message: 'phone and base64 are required',
        });
    }

    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({
            status: 'Disconnected',
            message: 'A sessão do WhatsApp não está ativa.',
            session,
        });
    }

    const to = phone;

    try {
        console.log(`>>> Enviando áudio para ${to}...`);

        // Remove data:audio/mp3;base64, prefix if present
        let audioData = base64;
        if (base64.includes(',')) {
            audioData = base64.split(',')[1];
        }

        // Send as voice message (PTT - Push to Talk)
        // WPPConnect uses sendPttFromBase64 or sendVoiceBase64
        await sessionData.client.sendPttFromBase64(
            to,
            audioData,
            'audio.mp3',
            'Mensagem de voz'
        );

        console.log('>>> Áudio enviado com sucesso!');

        return res.json({
            status: 'success',
            message: 'Voice message sent',
        });
    } catch (err) {
        console.error(`Erro ao enviar áudio para ${to}:`, err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

// ================================================
// 📌 API: Enviar Arquivo/Documento (PDF, DOC, etc.)
// ================================================
const fs = require('fs');
const path = require('path');
const os = require('os');

app.post('/api/:session/send-file-base64', async (req, res) => {
    const { session } = req.params;
    const { phone, base64, filename, caption, isLid } = req.body;

    if (!phone || !base64) {
        return res.status(400).json({
            status: 'error',
            message: 'phone and base64 are required',
        });
    }

    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({
            status: 'Disconnected',
            message: 'A sessão do WhatsApp não está ativa.',
            session,
        });
    }

    // Get the phone number (phone can be an array or string)
    const phoneNumber = Array.isArray(phone) ? phone[0] : phone;

    // Format: keep @lid if present, otherwise use as-is or add @c.us
    let to;
    if (isLid || phoneNumber.includes('@lid')) {
        to = phoneNumber.replace('@lid', '').replace('@c.us', '') + '@lid';
    } else if (phoneNumber.includes('@')) {
        to = phoneNumber;
    } else {
        to = phoneNumber.replace(/\D/g, '') + '@c.us';
    }

    try {
        console.log(`>>> [send-file-base64] Enviando arquivo para ${to}...`);
        console.log(`>>> Filename: ${filename}, Caption: ${caption}`);
        console.log(`>>> Base64 length: ${base64.length}`);

        // Parse data URI
        let fileData = base64;
        let mimeType = 'application/pdf';
        let actualBase64 = base64;

        if (base64.startsWith('data:')) {
            const match = base64.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                actualBase64 = match[2];
            }
            fileData = base64;
        } else {
            // Add data URI prefix
            const ext = (filename || 'pdf').split('.').pop().toLowerCase();
            const mimeTypes = {
                pdf: 'application/pdf',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                gif: 'image/gif',
                txt: 'text/plain',
            };
            mimeType = mimeTypes[ext] || 'application/octet-stream';
            fileData = `data:${mimeType};base64,${base64}`;
            actualBase64 = base64;
        }

        console.log(`>>> MimeType: ${mimeType}`);
        console.log(`>>> Actual base64 length: ${actualBase64.length}`);

        // APPROACH 1: Try sendFileFromBase64
        try {
            console.log('>>> Tentativa 1: sendFileFromBase64...');
            await sessionData.client.sendFileFromBase64(
                to,
                fileData,
                filename || 'documento.pdf',
                caption || ''
            );
            console.log('>>> Arquivo enviado com sucesso via sendFileFromBase64!');
            return res.json({ status: 'success', message: 'File sent via sendFileFromBase64' });
        } catch (err1) {
            console.log('>>> sendFileFromBase64 falhou:', err1.message);
        }

        // APPROACH 2: Save to temp file and use sendFile with path
        try {
            console.log('>>> Tentativa 2: Salvar arquivo temp e usar sendFile...');
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, `wpp_${Date.now()}_${filename || 'documento.pdf'}`);

            const fileBuffer = Buffer.from(actualBase64, 'base64');
            fs.writeFileSync(tempFilePath, fileBuffer);
            console.log(`>>> Arquivo temp criado: ${tempFilePath} (${fileBuffer.length} bytes)`);

            await sessionData.client.sendFile(
                to,
                tempFilePath,
                filename || 'documento.pdf',
                caption || ''
            );

            // Clean up temp file
            try { fs.unlinkSync(tempFilePath); } catch (e) { }

            console.log('>>> Arquivo enviado com sucesso via sendFile!');
            return res.json({ status: 'success', message: 'File sent via sendFile (temp)' });
        } catch (err2) {
            console.log('>>> sendFile (temp) falhou:', err2.message);
        }

        // APPROACH 3: Try sendDocument method
        try {
            console.log('>>> Tentativa 3: sendDocument...');
            // Some versions have sendDocument method
            if (typeof sessionData.client.sendDocument === 'function') {
                await sessionData.client.sendDocument(
                    to,
                    fileData,
                    filename || 'documento.pdf',
                    caption || ''
                );
                console.log('>>> Arquivo enviado com sucesso via sendDocument!');
                return res.json({ status: 'success', message: 'File sent via sendDocument' });
            }
        } catch (err3) {
            console.log('>>> sendDocument falhou:', err3.message);
        }

        // APPROACH 4: Try sendImage for PDFs (some versions treat documents as images)
        try {
            console.log('>>> Tentativa 4: sendImageFromBase64...');
            await sessionData.client.sendImageFromBase64(
                to,
                fileData,
                filename || 'documento.pdf',
                caption || ''
            );
            console.log('>>> Arquivo enviado com sucesso via sendImageFromBase64!');
            return res.json({ status: 'success', message: 'File sent via sendImageFromBase64' });
        } catch (err4) {
            console.log('>>> sendImageFromBase64 falhou:', err4.message);
        }

        // All approaches failed
        console.error('>>> Todas as tentativas falharam!');
        return res.status(500).json({
            status: 'error',
            message: 'Failed to send file after trying multiple methods',
        });

    } catch (err) {
        console.error(`Erro geral ao enviar arquivo para ${to}:`, err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

// ================================================
// 📌 API: Enviar Arquivo por Path Local
// ================================================
app.post('/api/:session/send-file-path', async (req, res) => {
    const { session } = req.params;
    const { phone, filePath, filename, caption, isLid } = req.body;

    if (!phone || !filePath) {
        return res.status(400).json({
            status: 'error',
            message: 'phone and filePath are required',
        });
    }

    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({
            status: 'Disconnected',
            message: 'A sessão do WhatsApp não está ativa.',
            session,
        });
    }

    // Get the phone number
    const phoneNumber = Array.isArray(phone) ? phone[0] : phone;

    let to;
    if (isLid || phoneNumber.includes('@lid')) {
        to = phoneNumber.replace('@lid', '').replace('@c.us', '') + '@lid';
    } else if (phoneNumber.includes('@')) {
        to = phoneNumber;
    } else {
        to = phoneNumber.replace(/\D/g, '') + '@c.us';
    }

    try {
        console.log(`>>> [send-file-path] Enviando arquivo para ${to}...`);
        console.log(`>>> FilePath: ${filePath}`);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                status: 'error',
                message: `File not found: ${filePath}`,
            });
        }

        await sessionData.client.sendFile(
            to,
            filePath,
            filename || path.basename(filePath),
            caption || ''
        );

        console.log('>>> Arquivo enviado com sucesso!');
        return res.json({ status: 'success', message: 'File sent' });

    } catch (err) {
        console.error(`Erro ao enviar arquivo para ${to}:`, err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

// ================================================
// 📌 API: Fechar Sessão
// ================================================
app.post('/api/:session/close-session', async (req, res) => {
    const { session } = req.params;
    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({ status: 'success', message: 'Session not found or already closed' });
    }

    try {
        await sessionData.client.close();
        delete sessions[session];
        console.log(`>>> Sessão ${session} fechada`);
        return res.json({ status: 'success', message: 'Session closed' });
    } catch (err) {
        console.error(`Erro ao fechar sessão ${session}:`, err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================
// 📌 API: Logout
// ================================================
app.post('/api/:session/logout-session', async (req, res) => {
    const { session } = req.params;
    const sessionData = sessions[session];

    if (!sessionData || !sessionData.client) {
        return res.json({ status: 'success', message: 'Session not found' });
    }

    try {
        await sessionData.client.logout();
        delete sessions[session];
        console.log(`>>> Sessão ${session} deslogada`);
        return res.json({ status: 'success', message: 'Logged out' });
    } catch (err) {
        console.error(`Erro ao deslogar sessão ${session}:`, err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================================================
// 📌 API: Generate Token (compatibility)
// ================================================
app.post('/api/:session/:secret/generate-token', (req, res) => {
    const { session, secret } = req.params;

    if (secret !== SECRET_TOKEN) {
        return res.status(403).json({ status: 'error', message: 'The SECRET_KEY is incorrect' });
    }

    const token = Buffer.from(`${session}:${Date.now()}`).toString('base64');

    res.json({
        status: 'success',
        session,
        token,
        full: `${session}:${token}`,
    });
});

// ================================================
// 📌 Health Check
// ================================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', sessions: Object.keys(sessions).length });
});

// ================================================
// 🚀 Iniciar Servidor
// ================================================
const PORT = process.env.PORT || 21465;
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 WPPConnect Server rodando na porta ${PORT}`);
    console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`========================================\n`);
});
