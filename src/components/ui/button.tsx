import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "secondary" | "outline" | "ghost" | "danger" | "neon" | "gradient";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "md", isLoading, disabled, children, ...props }, ref) => {
        const baseStyles =
            "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden";

        const variants = {
            default:
                "bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] text-white hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 focus:ring-[#8b5cf6]",
            secondary:
                "bg-[rgba(20,20,30,0.8)] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(30,30,45,0.9)] hover:border-[rgba(139,92,246,0.3)] focus:ring-[#8b5cf6]",
            outline:
                "border border-[rgba(255,255,255,0.1)] text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:border-[rgba(139,92,246,0.3)] hover:text-white focus:ring-[#8b5cf6]",
            ghost:
                "text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white focus:ring-[#8b5cf6]",
            danger:
                "bg-gradient-to-r from-[#ff3366] to-[#ff006e] text-white hover:shadow-[0_0_30px_rgba(255,51,102,0.4)] hover:-translate-y-0.5 focus:ring-[#ff3366]",
            neon:
                "bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#d946ef] text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 focus:ring-[#8b5cf6]",
            gradient:
                "bg-gradient-to-r from-[#8b5cf6] to-[#06ffd0] text-white hover:shadow-[0_0_30px_rgba(6,255,208,0.3)] hover:-translate-y-0.5 focus:ring-[#06ffd0]",
        };

        const sizes = {
            sm: "px-3 py-1.5 text-sm",
            md: "px-5 py-2.5 text-sm",
            lg: "px-7 py-3.5 text-base",
        };

        return (
            <button
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

export { Button };
