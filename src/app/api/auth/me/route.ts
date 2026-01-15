import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getTrialStatus, formatTrialStatusMessage } from "@/lib/trial";

export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
    }

    // Fetch full user data including onboarding fields
    const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            companyId: true,
            emailVerified: true,
            onboardingCompleted: true,
            onboardingStep: true,
        },
    });

    if (!fullUser) {
        return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
    }

    // Get trial status for user's company
    let trialInfo = null;
    if (fullUser.companyId) {
        const status = await getTrialStatus(fullUser.companyId);
        trialInfo = {
            ...status,
            message: formatTrialStatusMessage(status),
        };
    }

    return NextResponse.json(
        successResponse({
            id: fullUser.id,
            name: fullUser.name,
            email: fullUser.email,
            role: fullUser.role,
            avatar: fullUser.avatar,
            companyId: fullUser.companyId,
            emailVerified: fullUser.emailVerified,
            onboardingCompleted: fullUser.onboardingCompleted,
            onboardingStep: fullUser.onboardingStep,
            trial: trialInfo,
        })
    );
}
