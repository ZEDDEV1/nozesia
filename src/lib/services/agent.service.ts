/**
 * Agent Service
 * 
 * Encapsulates business logic for AI agents.
 */

import { prisma } from "../prisma";
import { invalidateAgentCache, invalidateTrainingDataCache } from "../cache";

interface CreateAgentData {
    name: string;
    personality: string;
    tone?: string;
    voiceEnabled?: boolean;
    voiceId?: string;
}

interface UpdateAgentData {
    name?: string;
    personality?: string;
    tone?: string;
    voiceEnabled?: boolean;
    voiceId?: string;
    isActive?: boolean;
}

export class AgentService {
    /**
     * List all agents for a company
     */
    static async list(companyId: string) {
        return prisma.aIAgent.findMany({
            where: { companyId },
            include: {
                _count: { select: { trainingData: true, conversations: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * Get a single agent by ID
     */
    static async getById(agentId: string, companyId: string) {
        return prisma.aIAgent.findFirst({
            where: { id: agentId, companyId },
            include: {
                trainingData: { orderBy: { createdAt: "desc" } },
                _count: { select: { conversations: true } },
            },
        });
    }

    /**
     * Create a new agent
     */
    static async create(companyId: string, data: CreateAgentData) {
        return prisma.aIAgent.create({
            data: {
                companyId,
                name: data.name,
                personality: data.personality,
                tone: data.tone || "professional",
                voiceEnabled: data.voiceEnabled || false,
                voiceId: data.voiceId || "nova",
            },
        });
    }

    /**
     * Update an agent
     */
    static async update(agentId: string, companyId: string, data: UpdateAgentData) {
        // First verify the agent belongs to the company
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId },
        });

        if (!agent) return null;

        const updated = await prisma.aIAgent.update({
            where: { id: agentId },
            data,
        });

        // Invalidate cache
        await invalidateAgentCache(agentId);

        return updated;
    }

    /**
     * Delete an agent
     */
    static async delete(agentId: string, companyId: string) {
        // First verify the agent belongs to the company
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId },
        });

        if (!agent) return null;

        await prisma.aIAgent.delete({ where: { id: agentId } });

        // Invalidate caches
        await Promise.all([
            invalidateAgentCache(agentId),
            invalidateTrainingDataCache(agentId),
        ]);

        return { success: true };
    }

    /**
     * Toggle agent active status
     */
    static async toggleActive(agentId: string, companyId: string) {
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId },
        });

        if (!agent) return null;

        return prisma.aIAgent.update({
            where: { id: agentId },
            data: { isActive: !agent.isActive },
        });
    }

    /**
     * Count agents for a company
     */
    static async count(companyId: string) {
        return prisma.aIAgent.count({ where: { companyId } });
    }

    /**
     * Count active agents for a company
     */
    static async countActive(companyId: string) {
        return prisma.aIAgent.count({ where: { companyId, isActive: true } });
    }
}
