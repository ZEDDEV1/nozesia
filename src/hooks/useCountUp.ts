import { useEffect, useState } from "react";
import { useMotionValue, animate } from "framer-motion";

interface UseCountUpOptions {
    end: number;
    duration?: number;
    start?: number;
}

/**
 * Hook para animar contagem de números usando Framer Motion
 * @param end - Número final
 * @param duration - Duração da animação em segundos (padrão: 1.5)
 * @param start - Número inicial (padrão: 0)
 */
export function useCountUp({ end, duration = 1.5, start = 0 }: UseCountUpOptions) {
    const [displayValue, setDisplayValue] = useState(start);
    const motionValue = useMotionValue(start);

    useEffect(() => {
        const controls = animate(motionValue, end, {
            duration,
            ease: "easeOut",
            onUpdate: (latest) => {
                setDisplayValue(Math.round(latest));
            },
        });

        return controls.stop;
    }, [end, duration, motionValue]);

    return displayValue;
}

/**
 * Hook para animar strings com fração (ex: "5/10")
 * @param endString - String final no formato "numerador/denominador"
 * @param duration - Duração da animação em segundos
 */
export function useCountUpFraction(endString: string, duration = 1.5) {
    const parts = endString.split("/");
    const isFraction = parts.length === 2;

    const [numeratorStr = "0", denominatorStr = "0"] = parts;
    const numerator = parseInt(numeratorStr, 10) || 0;
    const denominator = parseInt(denominatorStr, 10) || 0;

    // SEMPRE chama os hooks, independente da condição
    const animatedNumerator = useCountUp({ end: numerator, duration, start: 0 });
    const animatedDenominator = useCountUp({ end: denominator, duration, start: 0 });

    // Retorna a string apropriada baseado no tipo
    if (!isFraction) {
        return endString;
    }

    return `${animatedNumerator}/${animatedDenominator}`;
}
