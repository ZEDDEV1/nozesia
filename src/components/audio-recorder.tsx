"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";

interface AudioRecorderProps {
    onSend: (audioBlob: Blob) => Promise<void>;
    disabled?: boolean;
}

export function AudioRecorder({ onSend, disabled }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Format time as mm:ss
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            setError(null);

            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError("Navegador não suporta gravação de áudio");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Determine the best supported mime type
            let mimeType = "audio/webm";
            if (!MediaRecorder.isTypeSupported("audio/webm")) {
                if (MediaRecorder.isTypeSupported("audio/mp4")) {
                    mimeType = "audio/mp4";
                } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
                    mimeType = "audio/ogg";
                } else {
                    mimeType = ""; // Let browser choose
                }
            }

            const mediaRecorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
                setAudioBlob(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err: unknown) {
            console.error("Error starting recording:", err);

            const error = err as Error;
            if (error.name === "NotFoundError") {
                setError("Microfone não encontrado");
            } else if (error.name === "NotAllowedError") {
                setError("Permissão de microfone negada");
            } else if (error.name === "NotReadableError") {
                setError("Microfone em uso por outro app");
            } else {
                setError("Erro ao acessar microfone");
            }
        }
    }, []);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Stop stream tracks
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        }
    }, [isRecording]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        stopRecording();
        setAudioBlob(null);
        setRecordingTime(0);
    }, [stopRecording]);

    // Send audio
    const sendAudio = useCallback(async () => {
        if (!audioBlob) return;

        try {
            setIsSending(true);
            await onSend(audioBlob);
            setAudioBlob(null);
            setRecordingTime(0);
        } catch (err) {
            console.error("Error sending audio:", err);
            setError("Erro ao enviar áudio");
        } finally {
            setIsSending(false);
        }
    }, [audioBlob, onSend]);

    // Clear error after 3 seconds
    const clearError = useCallback(() => {
        setTimeout(() => setError(null), 3000);
    }, []);

    // Render mic button when not recording
    if (!isRecording && !audioBlob) {
        return (
            <div style={{ position: "relative", display: "inline-flex" }}>
                {error && (
                    <span style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        marginBottom: "8px",
                        padding: "6px 12px",
                        background: "rgba(239, 68, 68, 0.9)",
                        color: "white",
                        fontSize: "12px",
                        borderRadius: "6px",
                        whiteSpace: "nowrap",
                        zIndex: 100,
                    }}>
                        {error}
                    </span>
                )}
                <button
                    className="audio-recorder-btn"
                    onClick={() => {
                        startRecording();
                        if (error) clearError();
                    }}
                    disabled={disabled}
                    title={error || "Gravar áudio"}
                >
                    <Mic size={20} />
                </button>
            </div>
        );
    }

    // Render recording UI
    return (
        <div className="audio-recorder-active">
            {error && (
                <span className="audio-recorder-error">{error}</span>
            )}

            {/* Recording indicator */}
            {isRecording && (
                <>
                    <span className="audio-recorder-indicator" />
                    <span className="audio-recorder-time">{formatTime(recordingTime)}</span>
                </>
            )}

            {/* Preview when stopped */}
            {audioBlob && !isRecording && (
                <span className="audio-recorder-preview">
                    🎤 {formatTime(recordingTime)}
                </span>
            )}

            {/* Cancel button */}
            <button
                className="audio-recorder-cancel"
                onClick={cancelRecording}
                title="Cancelar"
            >
                <X size={18} />
            </button>

            {/* Stop/Send button */}
            {isRecording ? (
                <button
                    className="audio-recorder-stop"
                    onClick={stopRecording}
                    title="Parar gravação"
                >
                    <Square size={16} />
                </button>
            ) : audioBlob ? (
                <button
                    className="audio-recorder-send"
                    onClick={sendAudio}
                    disabled={isSending}
                    title="Enviar áudio"
                >
                    {isSending ? (
                        <Loader2 size={18} className="dash-spin" />
                    ) : (
                        <Send size={18} />
                    )}
                </button>
            ) : null}
        </div>
    );
}

export default AudioRecorder;
