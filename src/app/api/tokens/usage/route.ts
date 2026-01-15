/**
 * Token Usage API
 * 
 * Returns current token usage for the logged-in user's company
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkTokenLimit } from "@/lib/token-limit";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user?.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const tokenStatus = await checkTokenLimit(user.companyId);

        return NextResponse.json(successResponse({
            currentUsage: tokenStatus.currentUsage,
            monthlyLimit: tokenStatus.monthlyLimit,
            percentUsed: tokenStatus.percentUsed,
            isLimitReached: tokenStatus.isLimitReached,
            remainingTokens: tokenStatus.remainingTokens,
            upgradeRequired: tokenStatus.upgradeRequired,
            upgradeMessage: tokenStatus.upgradeMessage,
        }));
    } catch (error) {
        logger.error("Error fetching token usage", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
