"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface AudioPlayerProps {
    src: string;
    sender: "CUSTOMER" | "AI" | "HUMAN";
}

// Generate random waveform bars
const generateWaveform = (count: number = 40): number[] => {
    // Create a more realistic waveform pattern
    return Array.from({ length: count }, (_, i) => {
        const position = i / count;
        // Create peaks and valleys
        const base = Math.sin(position * Math.PI * 3) * 0.3 + 0.5;
        const noise = Math.random() * 0.3;
        return Math.max(0.1, Math.min(1, base + noise));
    });
};

export function AudioPlayer({ src, sender }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [waveform] = useState(() => generateWaveform(35));
    const [isLoading, setIsLoading] = useState(true);

    // Format time to mm:ss
    const formatTime = (time: number): string => {
        if (isNaN(time) || time === Infinity) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // Handle play/pause
    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(console.error);
        }
    }, [isPlaying]);

    // Handle playback speed
    const cyclePlaybackRate = useCallback(() => {
        const rates = [1, 1.5, 2, 0.5];
        const currentIndex = rates.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % rates.length;
        const newRate = rates[nextIndex];

        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    }, [playbackRate]);

    // Handle waveform click to seek
    const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        audio.currentTime = percentage * duration;
    }, [duration]);

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoading(false);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        const handleCanPlay = () => setIsLoading(false);
        const handleError = () => setIsLoading(false);

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("canplay", handleCanPlay);
        audio.addEventListener("error", handleError);

        return () => {
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("canplay", handleCanPlay);
            audio.removeEventListener("error", handleError);
        };
    }, []);

    // Calculate progress percentage
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const playedBars = Math.floor((progress / 100) * waveform.length);

    return (
        <div className="wa-audio-player">
            {/* Hidden audio element */}
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Avatar */}
            <div className={`wa-audio-avatar ${sender === "CUSTOMER" ? "customer" : ""}`}>
                <Mic size={20} />
            </div>

            {/* Controls */}
            <div className="wa-audio-controls">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Play/Pause Button */}
                    <button
                        className="wa-audio-play-btn"
                        onClick={togglePlay}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="dash-spinner" style={{ width: 16, height: 16 }} />
                        ) : isPlaying ? (
                            <Pause size={20} />
                        ) : (
                            <Play size={20} style={{ marginLeft: 2 }} />
                        )}
                    </button>

                    {/* Waveform */}
                    <div
                        className="wa-audio-waveform"
                        onClick={handleWaveformClick}
                        style={{ cursor: "pointer" }}
                    >
                        {waveform.map((height, index) => (
                            <div
                                key={index}
                                className={`wa-audio-bar ${index < playedBars
                                        ? "played"
                                        : index === playedBars && isPlaying
                                            ? "playing"
                                            : ""
                                    }`}
                                style={{
                                    height: `${height * 20}px`,
                                    animationDelay: isPlaying && index === playedBars
                                        ? `${(index % 5) * 0.1}s`
                                        : undefined,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Time and Speed */}
                <div className="wa-audio-info">
                    <span className="wa-audio-time">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <button
                        className="wa-audio-speed"
                        onClick={cyclePlaybackRate}
                        title="Velocidade de reprodução"
                    >
                        {playbackRate}x
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AudioPlayer;
