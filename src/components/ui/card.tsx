import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "glass" | "glow" | "stat" | "gradient";
    glowColor?: "purple" | "cyan" | "pink" | "blue" | "green";
    hoverable?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", glowColor = "purple", hoverable = true, ...props }, ref) => {
        const variants = {
            default: "bg-[rgba(15,15,20,0.8)] border border-[rgba(255,255,255,0.06)] backdrop-blur-xl",
            glass: "bg-[rgba(255,255,255,0.03)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)]",
            gradient: "bg-gradient-to-br from-[rgba(139,92,246,0.08)] to-[rgba(6,255,208,0.03)] border border-[rgba(255,255,255,0.06)] backdrop-blur-xl",
            glow: "bg-[rgba(15,15,20,0.8)] border border-[rgba(255,255,255,0.06)] backdrop-blur-xl",
            stat: "bg-gradient-to-br from-[rgba(139,92,246,0.08)] to-[rgba(6,255,208,0.03)] border border-[rgba(255,255,255,0.06)] backdrop-blur-xl relative overflow-hidden",
        };

        const glowColors = {
            purple: "hover:border-[rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
            cyan: "hover:border-[rgba(6,255,208,0.3)] hover:shadow-[0_0_30px_rgba(6,255,208,0.15)]",
            pink: "hover:border-[rgba(255,0,110,0.3)] hover:shadow-[0_0_30px_rgba(255,0,110,0.15)]",
            blue: "hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_0_30px_rgba(0,212,255,0.15)]",
            green: "hover:border-[rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]",
        };

        const hoverEffect = hoverable
            ? `transition-all duration-300 hover:-translate-y-1 ${glowColors[glowColor]}`
            : "";

        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-xl p-6",
                    variants[variant],
                    hoverEffect,
                    className
                )}
                {...props}
            />
        );
    }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 mb-4", className)}
        {...props}
    />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("text-xl font-semibold text-white", className)}
        {...props}
    />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-slate-400", className)}
        {...props}
    />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center pt-4 mt-4 border-t border-slate-700/50", className)}
        {...props}
    />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
