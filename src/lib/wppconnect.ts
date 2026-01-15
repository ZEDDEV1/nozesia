import { redisGet, redisSet, isRedisAvailable } from "./redis";
import type {
    WPPContact,
    WPPMessage,
} from "./wpp-types";

const WPPCONNECT_URL = process.env.WPPCONNECT_URL || "http://localhost:21465";
const WPPCONNECT_SECRET = process.env.WPPCONNECT_SECRET || "AGENTEDEIA_SECRET_2024";

// Token TTL: 24 hours
const TOKEN_TTL_SECONDS = 86400;

// Fallback: Store session tokens in memory if Redis unavailable
const memoryTokens: Record<string, string> = {};

// Helper: Get token from Redis or memory
async function getStoredToken(session: string): Promise<string | null> {
    if (isRedisAvailable()) {
        const cached = await redisGet<string>(`wpp:token:${session}`);
        if (cached) return cached;
    }
    return memoryTokens[session] || null;
}

// Helper: Store token in Redis and memory
async function storeToken(session: string, token: string): Promise<void> {
    memoryTokens[session] = token;
    if (isRedisAvailable()) {
        await redisSet(`wpp:token:${session}`, token, TOKEN_TTL_SECONDS);
    }
}

// Helper: Clear token
async function clearToken(session: string): Promise<void> {
    delete memoryTokens[session];
    if (isRedisAvailable()) {
        const { redisDel } = await import("./redis");
        await redisDel(`wpp:token:${session}`);
    }
}

interface WPPResponse<T = unknown> {
    status: string;
    response?: T;
    message?: string;
    token?: string;
}

async function wppRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: Record<string, unknown>,
    token?: string
): Promise<WPPResponse<T>> {
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        console.log(`[WPPConnect] ${method} ${WPPCONNECT_URL}${endpoint}`);

        const response = await fetch(`${WPPCONNECT_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();
        console.log(`[WPPConnect] Response:`, data);
        return data;
    } catch (error) {
        console.error("[WPPConnect] Request error:", error);
        throw error;
    }
}

// Generate token for API access
export async function generateToken(session: string): Promise<string | null> {
    try {
        const result = await wppRequest<{ token: string }>(
            `/api/${session}/${WPPCONNECT_SECRET}/generate-token`,
            "POST"
        );

        if (result.status === "success" && result.token) {
            await storeToken(session, result.token);
            return result.token;
        }
        return null;
    } catch {
        return null;
    }
}

// Get stored token or generate new one
async function getToken(session: string): Promise<string | null> {
    const stored = await getStoredToken(session);
    if (stored) {
        return stored;
    }
    return await generateToken(session);
}

// Start session and get QR Code
export async function startSession(session: string, webhookUrl?: string): Promise<{
    qrcode?: string;
    status: string;
    urlcode?: string;
} | null> {
    try {
        const token = await getToken(session);
        if (!token) {
            console.error("[WPPConnect] Failed to get token");
            return null;
        }

        const webhook = webhookUrl || process.env.WPPCONNECT_WEBHOOK_URL || `http://localhost:3000/api/whatsapp/webhook`;
        console.log("[WPPConnect] Starting session with webhook:", webhook);

        const result = await wppRequest<{
            qrcode?: string;
            status: string;
            urlcode?: string;
        }>(
            `/api/${session}/start-session`,
            "POST",
            {
                webhook,
                waitQrCode: true,
            },
            token
        );

        return result.response || { status: result.status || "unknown" };
    } catch (error) {
        console.error("[WPPConnect] Start session error:", error);
        return null;
    }
}

// Get QR Code for session
export async function getQrCode(session: string): Promise<string | null> {
    try {
        const token = await getToken(session);
        if (!token) return null;

        const response = await fetch(`${WPPCONNECT_URL}/api/${session}/qrcode-session`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("image")) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            return `data:${contentType};base64,${base64}`;
        }

        try {
            const data = await response.json();
            console.log("[WPPConnect] QR Code response:", data);
            return data.response?.qrcode || null;
        } catch {
            return null;
        }
    } catch (error) {
        console.error("[WPPConnect] getQrCode error:", error);
        return null;
    }
}

// Check session status
export async function checkSessionStatus(session: string): Promise<{
    status: string;
    connected: boolean;
    phone?: string;
} | null> {
    try {
        const token = await getToken(session);
        if (!token) return null;

        const result = await wppRequest<{
            status: boolean;
            message: string;
            session: string;
        }>(
            `/api/${session}/check-connection-session`,
            "GET",
            undefined,
            token
        );

        console.log("[WPPConnect] check-connection-session result:", result);

        const response = result.response || result;
        // Check if status is boolean true OR message indicates connected
        const isConnected = response.status === true || response.message === "Connected";

        console.log("[WPPConnect] isConnected:", isConnected);

        return {
            status: isConnected ? "CONNECTED" : "DISCONNECTED",
            connected: isConnected,
            phone: undefined,
        };
    } catch (error) {
        console.error("[WPPConnect] checkSessionStatus error:", error);
        return null;
    }
}

// Close session
export async function closeSession(session: string): Promise<boolean> {
    try {
        const token = await getToken(session);
        if (!token) return false;

        await wppRequest(`/api/${session}/close-session`, "POST", undefined, token);
        return true;
    } catch {
        return false;
    }
}

// Logout session
export async function logoutSession(session: string): Promise<boolean> {
    try {
        const token = await getToken(session);
        if (!token) return false;

        await wppRequest(`/api/${session}/logout-session`, "POST", undefined, token);
        await clearToken(session);
        return true;
    } catch {
        return false;
    }
}

// Send text message - tries multiple approaches
export async function sendTextMessage(
    session: string,
    phone: string,
    message: string
): Promise<boolean> {
    try {
        // Force regenerate token
        const token = await generateToken(session);
        if (!token) {
            console.error("[WPPConnect] Failed to get token for send");
            return false;
        }

        // For @lid format, we need to use the chatId directly
        // For numbers without suffix, add @c.us
        const chatId = phone.includes("@") ? phone : phone.replace(/\D/g, "") + "@c.us";

        console.log("[WPPConnect] Attempting to send message to:", chatId);

        // Try send-message endpoint first (different from send-text)
        try {
            const result = await wppRequest<{ status: string; response?: unknown }>(
                `/api/${session}/send-message`,
                "POST",
                {
                    phone: chatId,
                    message,
                    isGroup: false,
                },
                token
            );

            console.log("[WPPConnect] send-message result:", result);

            if (result.status === "success") {
                return true;
            }
        } catch (err) {
            console.log("[WPPConnect] send-message failed, trying send-text:", err);
        }

        // Try send-text as fallback
        try {
            const result2 = await wppRequest<{ status: string }>(
                `/api/${session}/send-text`,
                "POST",
                { phone: chatId, message },
                token
            );

            console.log("[WPPConnect] send-text result:", result2);

            if (result2.status === "success") {
                return true;
            }
        } catch (err) {
            console.log("[WPPConnect] send-text failed:", err);
        }

        // If using @lid and failed, try converting to number format with @c.us
        if (phone.includes("@lid")) {
            const phoneNumber = phone.replace("@lid", "").replace(/\D/g, "");
            console.log("[WPPConnect] Trying with clean number:", phoneNumber);

            try {
                const result3 = await wppRequest<{ status: string }>(
                    `/api/${session}/send-message`,
                    "POST",
                    {
                        phone: phoneNumber + "@c.us",
                        message,
                        isGroup: false,
                    },
                    token
                );

                console.log("[WPPConnect] send-message @c.us result:", result3);
                return result3.status === "success";
            } catch (err) {
                console.log("[WPPConnect] send-message @c.us failed:", err);
            }
        }

        return false;
    } catch (error) {
        console.error("[WPPConnect] Send error:", error);
        return false;
    }
}

// Send audio message
export async function sendAudioMessage(
    session: string,
    phone: string,
    audioBase64: string
): Promise<boolean> {
    try {
        const token = await getToken(session);
        if (!token) return false;

        const formattedPhone = phone.includes("@") ? phone : phone.replace(/\D/g, "") + "@c.us";

        const result = await wppRequest<{ status: string }>(
            `/api/${session}/send-voice-base64`,
            "POST",
            { phone: formattedPhone, base64: audioBase64 },
            token
        );
        return result.status === "success";
    } catch (error) {
        console.error("[WPPConnect] Send audio error:", error);
        return false;
    }
}

// Send image/file message
export async function sendImageMessage(
    session: string,
    phone: string,
    imageBase64: string,
    caption?: string
): Promise<boolean> {
    try {
        const token = await getToken(session);
        if (!token) return false;

        const formattedPhone = phone.includes("@") ? phone : phone.replace(/\D/g, "") + "@c.us";

        const result = await wppRequest<{ status: string }>(
            `/api/${session}/send-image`,
            "POST",
            {
                phone: formattedPhone,
                base64: imageBase64,
                caption: caption || "",
                isViewOnce: false
            },
            token
        );
        return result.status === "success";
    } catch (error) {
        console.error("[WPPConnect] Send image error:", error);
        return false;
    }
}

// Get all contacts from WhatsApp
export async function getContacts(session: string): Promise<WPPContact[]> {
    try {
        const token = await getToken(session);
        if (!token) return [];

        const result = await wppRequest<WPPContact[]>(
            `/api/${session}/all-contacts`,
            "GET",
            undefined,
            token
        );
        return result.response || [];
    } catch (error) {
        console.error("[WPPConnect] Get contacts error:", error);
        return [];
    }
}

// Get profile picture 
export async function getProfilePic(session: string, phone: string): Promise<string | null> {
    try {
        const token = await getToken(session);
        if (!token) return null;

        const formattedPhone = phone.includes("@") ? phone : phone.replace(/\D/g, "") + "@c.us";

        const result = await wppRequest<{ eurl?: string; imgFull?: string }>(
            `/api/${session}/profile-pic/${formattedPhone}`,
            "GET",
            undefined,
            token
        );
        return result.response?.eurl || result.response?.imgFull || null;
    } catch {
        return null;
    }
}

// Get chat messages
export async function getChatMessages(
    session: string,
    phone: string,
    count: number = 50
): Promise<WPPMessage[]> {
    try {
        const token = await getToken(session);
        if (!token) return [];

        const formattedPhone = phone.replace(/\D/g, "") + "@c.us";

        const result = await wppRequest<WPPMessage[]>(
            `/api/${session}/all-messages-in-chat/${formattedPhone}?count=${count}`,
            "GET",
            undefined,
            token
        );
        return result.response || [];
    } catch {
        return [];
    }
}

// Send file from URL or local path (for sending PDFs, documents, etc.)
// Downloads the file from URL or reads from local filesystem and sends as base64
export async function sendFile(
    session: string,
    phone: string,
    fileUrl: string,
    fileName: string
): Promise<boolean> {
    try {
        const token = await getToken(session);
        if (!token) return false;

        const formattedPhone = phone.includes("@") ? phone : phone.replace(/\D/g, "") + "@c.us";

        let base64: string;
        let arrayBuffer: ArrayBuffer;

        // Check if it's a local file path (starts with /uploads/)
        if (fileUrl.startsWith("/uploads/")) {
            console.log("[WPPConnect] Reading local file:", fileUrl);

            const fs = await import("fs/promises");
            const path = await import("path");

            // Construir caminho completo
            const localPath = path.join(
                process.cwd(),
                "public",
                fileUrl.replace(/^\/+/, "")
            );

            try {
                const fileBuffer = await fs.readFile(localPath);
                arrayBuffer = fileBuffer.buffer.slice(
                    fileBuffer.byteOffset,
                    fileBuffer.byteOffset + fileBuffer.byteLength
                );
                base64 = fileBuffer.toString("base64");
                console.log("[WPPConnect] Local file read successfully, size:", fileBuffer.length);
            } catch (fsError) {
                console.error("[WPPConnect] Failed to read local file:", fsError);
                return false;
            }
        } else {
            // Download from URL
            console.log("[WPPConnect] Downloading file from URL:", fileUrl);

            const response = await fetch(fileUrl);
            if (!response.ok) {
                console.error("[WPPConnect] Failed to download file:", response.status, response.statusText);
                return false;
            }

            arrayBuffer = await response.arrayBuffer();
            base64 = Buffer.from(arrayBuffer).toString("base64");
        }

        // Determine mime type from extension
        const ext = fileName.split(".").pop()?.toLowerCase() || "pdf";
        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            txt: "text/plain",
        };
        const mimeType = mimeTypes[ext] || "application/octet-stream";

        // Create data URL
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Check if using @lid format
        const isLid = formattedPhone.includes("@lid") || phone.includes("@lid");

        // WPPConnect expects phone as ARRAY
        const phoneArray = [formattedPhone.replace("@lid", "").replace("@c.us", "")];

        console.log("[WPPConnect] Sending file as base64:", {
            phone: phoneArray,
            fileName,
            mimeType,
            size: arrayBuffer.byteLength,
            isLid,
        });

        // APPROACH 1: Try send-file-base64 endpoint (phone must be array!)
        const result = await wppRequest<{ status: string; message?: string }>(`/api/${session}/send-file-base64`, "POST", {
            phone: phoneArray,
            base64: dataUrl,
            filename: fileName,
            caption: "",
            isGroup: false,
            isLid: isLid,
        }, token);

        if (result.status === "success") {
            console.log("[WPPConnect] File sent successfully via send-file-base64");
            return true;
        }

        console.log("[WPPConnect] send-file-base64 result:", result);

        // APPROACH 2: If it's a local file, try send-file-path endpoint
        if (fileUrl.startsWith("/uploads/")) {
            const fs = await import("fs/promises");
            const path = await import("path");
            const localPath = path.join(process.cwd(), "public", fileUrl.replace(/^\/+/, ""));

            // Verify the file exists before trying send-file-path
            try {
                await fs.access(localPath);
                console.log("[WPPConnect] Trying send-file-path with:", localPath);

                const result2 = await wppRequest<{ status: string }>(`/api/${session}/send-file-path`, "POST", {
                    phone: phoneArray,
                    filePath: localPath,
                    filename: fileName,
                    caption: "",
                    isLid: isLid,
                }, token);

                if (result2.status === "success") {
                    console.log("[WPPConnect] File sent successfully via send-file-path");
                    return true;
                }
                console.log("[WPPConnect] send-file-path result:", result2);
            } catch (pathError) {
                console.log("[WPPConnect] Could not use send-file-path:", pathError);
            }
        }

        return false;
    } catch (error) {
        console.error("[WPPConnect] Send file error:", error);
        return false;
    }
}

export const wppConnect = {
    generateToken,
    startSession,
    getQrCode,
    checkSessionStatus,
    closeSession,
    logoutSession,
    sendTextMessage,
    sendAudioMessage,
    sendImageMessage,
    sendFile,
    getContacts,
    getProfilePic,
    getChatMessages,
};
