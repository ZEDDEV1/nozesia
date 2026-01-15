/**
 * Plan Features API
 * 
 * Returns the current user's plan features and limits for UI rendering
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyPlanInfo, getAllFeaturesStatus } from "@/lib/plan-features";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user?.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const planInfo = await getCompanyPlanInfo(user.companyId);
        const featuresStatus = await getAllFeaturesStatus(user.companyId);

        // Map features to menu items for easy frontend consumption
        const menuLocks: Record<string, { locked: boolean; requiredPlan: string }> = {
            // Always available (Trial/Free)
            "/dashboard": { locked: false, requiredPlan: "Free" },
            "/dashboard/conversations": { locked: false, requiredPlan: "Free" },
            "/dashboard/interests": { locked: false, requiredPlan: "Free" },
            "/dashboard/products": { locked: false, requiredPlan: "Free" },
            "/dashboard/orders": { locked: false, requiredPlan: "Free" },
            "/dashboard/contacts": { locked: false, requiredPlan: "Free" },
            "/dashboard/agents": { locked: false, requiredPlan: "Free" },
            "/dashboard/whatsapp": { locked: false, requiredPlan: "Free" },
            "/dashboard/billing": { locked: false, requiredPlan: "Free" },
            "/dashboard/settings": { locked: false, requiredPlan: "Free" },
            "/dashboard/delivery-zones": { locked: false, requiredPlan: "Free" },

            // BASIC+ (Analytics)
            "/dashboard/analytics": {
                locked: !planInfo.features.allowAnalytics,
                requiredPlan: "Basic"
            },

            // PRO+ features (CRM, Campaigns, Templates, Team)
            "/dashboard/crm": {
                locked: !planInfo.features.allowCRM,
                requiredPlan: "Pro"
            },
            "/dashboard/campaigns": {
                locked: !planInfo.features.allowCampaigns,
                requiredPlan: "Pro"
            },
            "/dashboard/templates": {
                locked: !planInfo.features.allowAutoRecovery,
                requiredPlan: "Pro"
            },
            "/dashboard/team": {
                locked: planInfo.limits.maxTeamMembers <= 1,
                requiredPlan: "Pro"
            },

            // ENTERPRISE+ features (Premium)
            "/dashboard/webhooks": {
                locked: planInfo.limits.maxWebhooks === 0,
                requiredPlan: "Enterprise"
            },
            "/dashboard/creatives": {
                locked: planInfo.limits.maxCreativesMonth === 0,
                requiredPlan: "Enterprise"
            },
        };

        return NextResponse.json(successResponse({
            plan: {
                id: planInfo.planId,
                name: planInfo.planName,
                type: planInfo.planType,
            },
            isTrialActive: planInfo.isTrialActive,
            trialDaysRemaining: planInfo.trialDaysRemaining,
            hasPaid: planInfo.hasPaid,
            limits: planInfo.limits,
            features: planInfo.features,
            featuresStatus,
            menuLocks,
        }));
    } catch (error) {
        logger.error("Error fetching plan features", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
