/**
 * System Settings Service
 * 
 * Gerencia configurações globais do sistema usando a tabela SystemSettings.
 * Substitui o uso do AuditLog para armazenar configurações.
 * 
 * Uso:
 *   import { getSetting, setSetting, getAllSettings } from "@/lib/settings";
 *   
 *   const model = await getSetting("openaiModel", "gpt-4o-mini");
 *   await setSetting("openaiModel", "gpt-4o");
 */

import { prisma } from "./prisma";
import { redisGet, redisSet, redisDel, isRedisAvailable } from "./redis";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export interface SettingDefinition {
    key: string;
    defaultValue: string;
    description: string;
}

// Default settings with their descriptions
export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
    openaiModel: {
        key: "openaiModel",
        defaultValue: "gpt-4o-mini",
        description: "Modelo da OpenAI para respostas de IA",
    },
    webhookUrl: {
        key: "webhookUrl",
        defaultValue: "http://localhost:3000/api/whatsapp/webhook",
        description: "URL do webhook para receber mensagens do WhatsApp",
    },
    defaultTimezone: {
        key: "defaultTimezone",
        defaultValue: "America/Sao_Paulo",
        description: "Timezone padrão do sistema",
    },
    emailNotifications: {
        key: "emailNotifications",
        defaultValue: "true",
        description: "Habilitar notificações por email",
    },
    slackNotifications: {
        key: "slackNotifications",
        defaultValue: "false",
        description: "Habilitar notificações por Slack",
    },
    systemName: {
        key: "systemName",
        defaultValue: "NozesIA",
        description: "Nome do sistema",
    },
    supportEmail: {
        key: "supportEmail",
        defaultValue: "suporte@nozesia.com",
        description: "Email de suporte",
    },
};

// Cache TTL: 5 minutes
const CACHE_TTL = 300;
const CACHE_PREFIX = "settings";

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get a single setting value
 * First checks cache, then database, then returns default
 */
export async function getSetting(key: string, defaultValue?: string): Promise<string> {
    const cacheKey = `${CACHE_PREFIX}:${key}`;

    // Try cache first
    if (isRedisAvailable()) {
        try {
            const cached = await redisGet<string>(cacheKey);
            if (cached !== null) {
                logger.debug(`[Settings] Cache hit for ${key}`);
                return cached;
            }
        } catch (error) {
            logger.warn("[Settings] Cache read error", { key, error });
        }
    }

    // Try database
    try {
        const setting = await prisma.systemSettings.findUnique({
            where: { key },
        });

        if (setting) {
            // Update cache
            if (isRedisAvailable()) {
                await redisSet(cacheKey, setting.value, CACHE_TTL);
            }
            return setting.value;
        }
    } catch (error) {
        logger.error("[Settings] Database read error", { key, error });
    }

    // Return default
    const def = SETTING_DEFINITIONS[key];
    return defaultValue ?? def?.defaultValue ?? "";
}

/**
 * Set a setting value
 * Updates both database and cache
 */
export async function setSetting(key: string, value: string, description?: string): Promise<boolean> {
    try {
        await prisma.systemSettings.upsert({
            where: { key },
            update: { value, updatedAt: new Date() },
            create: {
                key,
                value,
                description: description || SETTING_DEFINITIONS[key]?.description,
            },
        });

        // Update cache
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        if (isRedisAvailable()) {
            await redisSet(cacheKey, value, CACHE_TTL);
        }

        logger.info(`[Settings] Updated ${key}`);
        return true;
    } catch (error) {
        logger.error("[Settings] Error setting value", { key, error });
        return false;
    }
}

/**
 * Delete a setting (reset to default)
 */
export async function deleteSetting(key: string): Promise<boolean> {
    try {
        await prisma.systemSettings.delete({
            where: { key },
        }).catch(() => {
            // Ignore if doesn't exist
        });

        // Clear cache
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        if (isRedisAvailable()) {
            await redisDel(cacheKey);
        }

        return true;
    } catch (error) {
        logger.error("[Settings] Error deleting setting", { key, error });
        return false;
    }
}

/**
 * Get all settings as an object
 */
export async function getAllSettings(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    // Start with defaults
    for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
        result[key] = def.defaultValue;
    }

    // Override with database values
    try {
        const settings = await prisma.systemSettings.findMany();
        for (const setting of settings) {
            result[setting.key] = setting.value;
        }
    } catch (error) {
        logger.error("[Settings] Error getting all settings", { error });
    }

    return result;
}

/**
 * Set multiple settings at once
 */
export async function setMultipleSettings(settings: Record<string, string>): Promise<boolean> {
    try {
        await prisma.$transaction(
            Object.entries(settings).map(([key, value]) =>
                prisma.systemSettings.upsert({
                    where: { key },
                    update: { value, updatedAt: new Date() },
                    create: {
                        key,
                        value,
                        description: SETTING_DEFINITIONS[key]?.description,
                    },
                })
            )
        );

        // Update cache for all
        if (isRedisAvailable()) {
            for (const [key, value] of Object.entries(settings)) {
                await redisSet(`${CACHE_PREFIX}:${key}`, value, CACHE_TTL);
            }
        }

        logger.info("[Settings] Updated multiple settings", { keys: Object.keys(settings) });
        return true;
    } catch (error) {
        logger.error("[Settings] Error setting multiple values", { error });
        return false;
    }
}

/**
 * Clear all settings cache
 */
export async function clearSettingsCache(): Promise<void> {
    if (isRedisAvailable()) {
        for (const key of Object.keys(SETTING_DEFINITIONS)) {
            await redisDel(`${CACHE_PREFIX}:${key}`);
        }
    }
}

// ============================================
// TYPED HELPERS
// ============================================

/**
 * Get boolean setting
 */
export async function getSettingBool(key: string, defaultValue = false): Promise<boolean> {
    const value = await getSetting(key, String(defaultValue));
    return value === "true" || value === "1";
}

/**
 * Get number setting
 */
export async function getSettingNumber(key: string, defaultValue = 0): Promise<number> {
    const value = await getSetting(key, String(defaultValue));
    return parseInt(value, 10) || defaultValue;
}

// ============================================
// SPECIFIC GETTERS (for easy imports)
// ============================================

/**
 * Get the configured OpenAI model
 */
export async function getOpenAIModel(): Promise<string> {
    return getSetting("openaiModel", "gpt-4o-mini");
}

/**
 * Get the webhook URL
 */
export async function getWebhookUrl(): Promise<string> {
    return getSetting("webhookUrl", "http://localhost:3000/api/whatsapp/webhook");
}
