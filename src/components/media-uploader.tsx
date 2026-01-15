"use client";

import { useState, useRef, useCallback } from "react";
import { X, Image, FileText, Send, Loader2 } from "lucide-react";

interface MediaUploaderProps {
    conversationId: string;
    customerPhone: string;
    sessionId: string | null;
    onClose: () => void;
    onSent: () => void;
    disabled?: boolean;
}

type FileType = "image" | "document" | "audio";

interface FilePreview {
    file: File;
    type: FileType;
    preview: string | null;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const ACCEPTED_TYPES = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4"],
};

function getFileType(mimeType: string): FileType {
    if (ACCEPTED_TYPES.image.includes(mimeType)) return "image";
    if (ACCEPTED_TYPES.audio.includes(mimeType)) return "audio";
    return "document";
}

function getFileIcon(type: FileType) {
    switch (type) {
        case "image": return <Image size={48} />;
        case "document": return <FileText size={48} />;
        case "audio": return <span style={{ fontSize: 48 }}>🎵</span>;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploader({
    conversationId,
    customerPhone,
    sessionId,
    onClose,
    onSent,
    disabled,
}: MediaUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
    const [caption, setCaption] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError("");

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            setError(`Arquivo muito grande. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`);
            return;
        }

        // Validate type
        const allAccepted = [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.document, ...ACCEPTED_TYPES.audio];
        if (!allAccepted.includes(file.type)) {
            setError("Tipo de arquivo não suportado");
            return;
        }

        const type = getFileType(file.type);
        let preview: string | null = null;

        if (type === "image") {
            preview = URL.createObjectURL(file);
        }

        setFilePreview({ file, type, preview });
    }, []);

    const handleSend = useCallback(async () => {
        if (!filePreview || !sessionId) return;

        setSending(true);
        setError("");

        try {
            // Convert file to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data:mime;base64, prefix
                    const base64 = result.split(",")[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(filePreview.file);
            const base64 = await base64Promise;

            // Send to API
            const res = await fetch(`/api/conversations/${conversationId}/media`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: filePreview.type,
                    base64,
                    filename: filePreview.file.name,
                    mimetype: filePreview.file.type,
                    caption: caption.trim() || undefined,
                    phone: customerPhone,
                    sessionId,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Erro ao enviar arquivo");
            }

            onSent();
            onClose();
        } catch (err) {
            console.error("Error sending media:", err);
            setError(err instanceof Error ? err.message : "Erro ao enviar arquivo");
        } finally {
            setSending(false);
        }
    }, [filePreview, sessionId, conversationId, customerPhone, caption, onSent, onClose]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const clearFile = useCallback(() => {
        setFilePreview(null);
        setCaption("");
        setError("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    return (
        <div className="media-uploader-overlay" onClick={onClose}>
            <div className="media-uploader-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="media-uploader-header">
                    <h3>Enviar arquivo</h3>
                    <button onClick={onClose} className="media-uploader-close">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="media-uploader-content">
                    {!filePreview ? (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={[...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.document, ...ACCEPTED_TYPES.audio].join(",")}
                                onChange={handleFileSelect}
                                style={{ display: "none" }}
                            />
                            <div className="media-uploader-dropzone" onClick={triggerFileSelect}>
                                <div className="media-uploader-icons">
                                    <Image size={32} />
                                    <FileText size={32} />
                                </div>
                                <p>Clique para selecionar um arquivo</p>
                                <span>Imagens, PDFs, Documentos (máx. 16MB)</span>
                            </div>
                        </>
                    ) : (
                        <div className="media-uploader-preview">
                            {filePreview.type === "image" && filePreview.preview && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={filePreview.preview} alt="Preview do arquivo" />
                            )}
                            {filePreview.type !== "image" && (
                                <div className="media-uploader-file-icon">
                                    {getFileIcon(filePreview.type)}
                                </div>
                            )}
                            <div className="media-uploader-file-info">
                                <span className="media-uploader-filename">{filePreview.file.name}</span>
                                <span className="media-uploader-filesize">{formatFileSize(filePreview.file.size)}</span>
                            </div>
                            <button onClick={clearFile} className="media-uploader-remove">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="media-uploader-error">{error}</div>
                    )}
                </div>

                {/* Footer */}
                {filePreview && (
                    <div className="media-uploader-footer">
                        <input
                            type="text"
                            value={caption}
                            onChange={e => setCaption(e.target.value)}
                            placeholder="Adicione uma legenda..."
                            className="media-uploader-caption"
                            disabled={sending}
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || disabled}
                            className="media-uploader-send"
                        >
                            {sending ? <Loader2 size={20} className="dash-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MediaUploader;
