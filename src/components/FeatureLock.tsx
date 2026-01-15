"use client";

import { Lock, Crown, Sparkles } from "lucide-react";
import Link from "next/link";

interface FeatureLockProps {
    /** Feature name to display */
    featureName: string;
    /** Minimum plan required for this feature */
    requiredPlan: "Basic" | "Pro" | "Enterprise";
    /** Whether the feature is currently locked */
    isLocked: boolean;
    /** Children to render when unlocked */
    children: React.ReactNode;
    /** Optional: Show as overlay instead of replacing content */
    overlay?: boolean;
}

/**
 * Component that shows a lock overlay when a feature is not available
 * in the user's current plan
 */
export function FeatureLock({
    featureName,
    requiredPlan,
    isLocked,
    children,
    overlay = false,
}: FeatureLockProps) {
    if (!isLocked) {
        return <>{children}</>;
    }

    if (overlay) {
        return (
            <div className="relative">
                {children}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-10">
                    <LockContent featureName={featureName} requiredPlan={requiredPlan} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[var(--card-bg)] rounded-xl border border-[var(--border-subtle)]">
            <LockContent featureName={featureName} requiredPlan={requiredPlan} />
        </div>
    );
}

function LockContent({ featureName, requiredPlan }: { featureName: string; requiredPlan: string }) {
    const planColors: Record<string, string> = {
        Basic: "text-blue-400",
        Pro: "text-purple-400",
        Standard: "text-amber-400",
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--border-subtle)] flex items-center justify-center">
                <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    {featureName}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Disponível a partir do plano{" "}
                    <span className={`font-semibold ${planColors[requiredPlan] || "text-white"}`}>
                        {requiredPlan}
                    </span>
                </p>
            </div>
            <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
                <Crown className="w-4 h-4" />
                Fazer Upgrade
            </Link>
        </div>
    );
}

/**
 * Menu item with lock icon for navigation
 */
interface LockedMenuItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    isLocked: boolean;
    requiredPlan: string;
}

export function LockedMenuItem({
    href,
    icon,
    label,
    isLocked,
    requiredPlan,
}: LockedMenuItemProps) {
    if (isLocked) {
        return (
            <div
                className="flex items-center justify-between px-4 py-2 text-gray-500 cursor-not-allowed rounded-lg"
                title={`Requer plano ${requiredPlan}`}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span>{label}</span>
                </div>
                <Lock className="w-4 h-4" />
            </div>
        );
    }

    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-[var(--border-subtle)] rounded-lg transition-colors"
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

/**
 * Badge to show on locked features in lists/cards
 */
export function ProBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full">
            <Sparkles className="w-3 h-3" />
            Pro
        </span>
    );
}

export function StandardBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
            <Crown className="w-3 h-3" />
            Standard
        </span>
    );
}
