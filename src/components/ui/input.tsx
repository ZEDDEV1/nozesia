import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    variant?: "default" | "ghost";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, icon, variant = "default", ...props }, ref) => {
        const variants = {
            default: "bg-[#0f0f14] border-[rgba(255,255,255,0.06)]",
            ghost: "bg-transparent border-[rgba(255,255,255,0.1)]",
        };

        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-2">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#71717a] group-focus-within:text-[#8b5cf6] transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            "w-full px-4 py-3 border rounded-xl text-white placeholder:text-[#71717a]",
                            "focus:outline-none focus:border-[#8b5cf6] focus:ring-[3px] focus:ring-[rgba(139,92,246,0.15)]",
                            "transition-all duration-300",
                            variants[variant],
                            icon && "pl-11",
                            error && "border-[#ff3366] focus:border-[#ff3366] focus:ring-[rgba(255,51,102,0.15)]",
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {/* Glow effect on focus */}
                    <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-300 bg-gradient-to-r from-[rgba(139,92,246,0.05)] to-transparent" />
                </div>
                {error && <p className="mt-2 text-sm text-[#ff3366]">{error}</p>}
            </div>
        );
    }
);

Input.displayName = "Input";

export { Input };

