"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useCountUp, useCountUpFraction } from "@/hooks/useCountUp";
import Link from "next/link";

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    color: "emerald" | "purple" | "cyan" | "amber";
    trend?: {
        value: number; // Porcentagem de mudança (ex: 12 para +12%, -5 para -5%)
        label?: string; // Texto opcional (ex: "vs mês anterior")
    };
    index?: number; // Para stagger animation
    href?: string; // Link opcional para tornar o card clicável
}

export function StatCard({ title, value, icon: Icon, color, trend, index = 0, href }: StatCardProps) {
    // Determina se o valor é um número ou string com fração
    const isNumber = typeof value === "number";
    const isFraction = typeof value === "string" && value.includes("/");

    // Animação de count-up
    const animatedNumber = useCountUp({
        end: isNumber ? value : 0,
        duration: 1.5
    });

    const animatedFraction = useCountUpFraction(
        isFraction ? value : "0/0",
        1.5
    );

    // Determina qual valor exibir
    const displayValue = isNumber
        ? animatedNumber
        : isFraction
            ? animatedFraction
            : value;

    // Determina o tipo de trend
    const trendType = trend
        ? trend.value > 0
            ? "positive"
            : trend.value < 0
                ? "negative"
                : "neutral"
        : null;

    const TrendIcon = trendType === "positive"
        ? TrendingUp
        : trendType === "negative"
            ? TrendingDown
            : Minus;

    const cardContent = (
        <motion.div
            className="dash-stat-card"
            data-color={color}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: [0.4, 0, 0.2, 1]
            }}
            whileHover={{
                scale: 1.02,
                transition: { duration: 0.2 }
            }}
            style={href ? { cursor: "pointer" } : undefined}
        >
            <div className="dash-stat-header">
                <div>
                    <div className="dash-stat-label">{title}</div>
                    <motion.div
                        className="dash-stat-value"
                        key={displayValue} // Re-animar quando o valor mudar
                    >
                        {displayValue}
                    </motion.div>

                    {trend && (
                        <motion.div
                            className={`dash-stat-trend ${trendType}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + (index * 0.1) }}
                        >
                            <TrendIcon />
                            <span>
                                {trend.value > 0 ? "+" : ""}{trend.value}%
                            </span>
                            {trend.label && (
                                <span style={{ opacity: 0.7, marginLeft: 2 }}>
                                    {trend.label}
                                </span>
                            )}
                        </motion.div>
                    )}
                </div>
                <motion.div
                    className={`dash-stat-icon ${color}`}
                    whileHover={{
                        scale: 1.1,
                        rotate: 5,
                        transition: { duration: 0.2 }
                    }}
                >
                    <Icon />
                </motion.div>
            </div>
        </motion.div>
    );

    // Se tem href, envolve com Link
    if (href) {
        return <Link href={href} style={{ textDecoration: "none" }}>{cardContent}</Link>;
    }

    return cardContent;
}

