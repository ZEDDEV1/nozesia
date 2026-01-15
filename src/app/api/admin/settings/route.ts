import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
    getAllSettings,
    setMultipleSettings,
} from "@/lib/settings";
import {
    successResponse,
    errorResponse,
    handleApiError,
    jsonSuccess,
    jsonError,
} from "@/lib/api-response";
import { logger } from "@/lib/logger";

// Valid OpenAI models
const VALID_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];

// GET - Get current settings
export async function GET() {
    try {
        await requireRole(["SUPER_ADMIN"]);

        const settings = await getAllSettings();
        return NextResponse.json(successResponse(settings));
    } catch (error) {
        logger.error("[Admin Settings] Error", { error, route: "/api/admin/settings" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update settings
export async function PUT(request: Request) {
    try {
        await requireRole(["SUPER_ADMIN"]);

        const body = await request.json();
        const {
            openaiModel,
            webhookUrl,
            defaultTimezone,
            emailNotifications,
            slackNotifications,
            systemName,
            supportEmail,
        } = body;

        // Validate model
        if (openaiModel && !VALID_MODELS.includes(openaiModel)) {
            return NextResponse.json(errorResponse("Modelo inválido"), { status: 400 });
        }

        // Get current settings to merge
        const currentSettings = await getAllSettings();

        // Build new settings (only update provided values)
        const newSettings: Record<string, string> = {};

        if (openaiModel !== undefined) {
            newSettings.openaiModel = openaiModel;
        }
        if (webhookUrl !== undefined) {
            newSettings.webhookUrl = webhookUrl;
        }
        if (defaultTimezone !== undefined) {
            newSettings.defaultTimezone = defaultTimezone;
        }
        if (emailNotifications !== undefined) {
            newSettings.emailNotifications = String(emailNotifications);
        }
        if (slackNotifications !== undefined) {
            newSettings.slackNotifications = String(slackNotifications);
        }
        if (systemName !== undefined) {
            newSettings.systemName = systemName;
        }
        if (supportEmail !== undefined) {
            newSettings.supportEmail = supportEmail;
        }

        // Update settings
        const success = await setMultipleSettings(newSettings);

        if (!success) {
            return jsonError("Erro ao salvar configurações", 500);
        }

        // Return merged settings
        const updatedSettings = { ...currentSettings, ...newSettings };
        return jsonSuccess(updatedSettings);
    } catch (error) {
        logger.error("[Admin Settings] Error", { error, route: "/api/admin/settings" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
