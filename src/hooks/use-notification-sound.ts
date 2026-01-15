"use client";

import { useCallback, useRef } from "react";

/**
 * Hook for playing notification sounds
 * Uses Web Audio API for better browser compatibility
 */
export function useNotificationSound() {
    const audioContextRef = useRef<AudioContext | null>(null);

    const playSound = useCallback((type: "order" | "message" | "success" | "error" = "order") => {
        try {
            // Create audio context on first use (requires user interaction)
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            }

            const ctx = audioContextRef.current;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Different sounds for different types
            const soundConfigs = {
                order: { freq: [800, 1000, 800], duration: 0.15 },
                message: { freq: [600, 800], duration: 0.1 },
                success: { freq: [523, 659, 784], duration: 0.12 },
                error: { freq: [400, 300], duration: 0.2 },
            };

            const config = soundConfigs[type];
            const now = ctx.currentTime;

            oscillator.type = "sine";
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + config.duration * config.freq.length);

            // Play sequence of frequencies
            config.freq.forEach((freq, i) => {
                oscillator.frequency.setValueAtTime(freq, now + i * config.duration);
            });

            oscillator.start(now);
            oscillator.stop(now + config.duration * config.freq.length);
        } catch (error) {
            console.warn("Could not play notification sound:", error);
        }
    }, []);

    return { playSound };
}
