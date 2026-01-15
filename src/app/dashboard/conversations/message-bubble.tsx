"use client";

import { useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { formatTime } from "@/lib/date-utils";
import { Message } from "./conversations-types";
import { X, ExternalLink, Download } from "lucide-react";

interface MessageBubbleProps {
    message: Message;
}

// Regex para detectar URLs de imagem no texto
const IMAGE_URL_REGEX = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s]*)?)/gi;
const VIDEO_URL_REGEX = /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|avi)(?:\?[^\s]*)?)/gi;

/**
 * Componente para renderizar uma mensagem individual no chat
 */
export function MessageBubble({ message }: MessageBubbleProps) {
    const [showLightbox, setShowLightbox] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState("");

    const isOutgoing = message.sender !== "CUSTOMER";
    const senderClass = message.sender === "AI" ? "ai" : message.sender === "HUMAN" ? "human" : "";

    const openLightbox = (src: string) => {
        setLightboxSrc(src);
        setShowLightbox(true);
    };

    const renderContent = () => {
        const type = message.type?.toUpperCase() || "TEXT";
        const src = message.mediaUrl || message.content;

        // Imagem
        if (type === "IMAGE" && (src?.startsWith("http") || src?.startsWith("data:"))) {
            return (
                <div className="chat-bubble-image">
                    <img
                        src={src}
                        alt=""
                        onClick={() => openLightbox(src)}
                        style={{ cursor: "zoom-in" }}
                    />
                </div>
            );
        }

        // Áudio
        if ((type === "AUDIO" || type === "PTT") && (src?.startsWith("http") || src?.startsWith("data:"))) {
            return <AudioPlayer src={src} sender={message.sender} />;
        }

        // Video
        if (type === "VIDEO" && src?.startsWith("http")) {
            return (
                <div className="chat-bubble-video">
                    <video
                        controls
                        src={src}
                        style={{
                            maxWidth: "100%",
                            maxHeight: 300,
                            borderRadius: 8
                        }}
                    />
                </div>
            );
        }

        // Fallbacks para mídia sem URL
        if (type === "IMAGE") return <span>📷 Imagem</span>;
        if (type === "AUDIO" || type === "PTT") return <span>🎤 Áudio</span>;
        if (type === "VIDEO") return <span>🎥 Vídeo</span>;

        // Documento
        if (type === "DOCUMENT") {
            if (src?.startsWith("http")) {
                return (
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chat-document-link"
                    >
                        📄 Documento
                    </a>
                );
            }
            return <span>📄 Documento</span>;
        }

        // Texto com detecção de URLs de imagem inline
        const content = message.content || "";
        const imageMatches = content.match(IMAGE_URL_REGEX);
        const videoMatches = content.match(VIDEO_URL_REGEX);

        // Se encontrou imagens inline no texto
        if (imageMatches && imageMatches.length > 0) {
            // Texto sem as URLs de imagem
            let textContent = content;
            imageMatches.forEach(url => {
                textContent = textContent.replace(url, "").trim();
            });

            return (
                <div>
                    {textContent && <span className="chat-text-preserve">{textContent}</span>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: textContent ? 8 : 0 }}>
                        {imageMatches.map((url, i) => (
                            <img
                                key={i}
                                src={url}
                                alt=""
                                onClick={() => openLightbox(url)}
                                style={{
                                    maxWidth: 200,
                                    maxHeight: 150,
                                    borderRadius: 8,
                                    cursor: "zoom-in",
                                    objectFit: "cover",
                                }}
                            />
                        ))}
                    </div>
                </div>
            );
        }

        // Se encontrou vídeos inline no texto
        if (videoMatches && videoMatches.length > 0) {
            let textContent = content;
            videoMatches.forEach(url => {
                textContent = textContent.replace(url, "").trim();
            });

            return (
                <div>
                    {textContent && <span className="chat-text-preserve">{textContent}</span>}
                    {videoMatches.map((url, i) => (
                        <video
                            key={i}
                            controls
                            src={url}
                            style={{
                                maxWidth: "100%",
                                maxHeight: 250,
                                borderRadius: 8,
                                marginTop: textContent ? 8 : 0,
                            }}
                        />
                    ))}
                </div>
            );
        }

        // Texto padrão
        return <span className="chat-text-preserve">{content}</span>;
    };

    return (
        <>
            <div className={`chat-message ${isOutgoing ? "outgoing" : "incoming"} ${senderClass}`}>
                <div className="chat-bubble">
                    {isOutgoing && (
                        <div className="chat-bubble-sender">
                            {message.sender === "AI" ? "🤖 IA" : "👤 Você"}
                        </div>
                    )}
                    <div className="chat-bubble-content">{renderContent()}</div>
                    <div className="chat-bubble-time">
                        {formatTime(message.createdAt)}
                        {isOutgoing && message.isRead && <span className="chat-read-indicator">✓✓</span>}
                    </div>
                </div>
            </div>

            {/* Lightbox para visualização de imagem */}
            {showLightbox && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.9)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2rem",
                    }}
                    onClick={() => setShowLightbox(false)}
                >
                    <img
                        src={lightboxSrc}
                        alt=""
                        style={{
                            maxWidth: "90%",
                            maxHeight: "90%",
                            objectFit: "contain",
                            borderRadius: 12,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: 20,
                            right: 20,
                            display: "flex",
                            gap: "0.75rem",
                        }}
                    >
                        <a
                            href={lightboxSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: 8,
                                padding: "0.75rem",
                                cursor: "pointer",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textDecoration: "none",
                            }}
                            title="Abrir em nova aba"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <a
                            href={lightboxSrc}
                            download
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: 8,
                                padding: "0.75rem",
                                cursor: "pointer",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textDecoration: "none",
                            }}
                            title="Baixar"
                        >
                            <Download size={20} />
                        </a>
                        <button
                            onClick={() => setShowLightbox(false)}
                            style={{
                                background: "rgba(255,255,255,0.1)",
                                border: "none",
                                borderRadius: 8,
                                padding: "0.75rem",
                                cursor: "pointer",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            title="Fechar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
