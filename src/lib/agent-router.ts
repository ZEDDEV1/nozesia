/**
 * Agent Router - Multi-Agent Intelligent Routing
 * 
 * Selects the best agent based on message content keywords.
 * Falls back to default agent if no match.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

interface AgentCandidate {
    id: string;
    name: string;
    triggerKeywords: string[];
    priority: number;
    isDefault: boolean;
    matchScore: number;
}

/**
 * Normalize text for keyword matching
 * Removes accents, lowercase, trim
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .trim();
}

/**
 * Check if message contains any of the keywords
 * Returns number of matching keywords
 */
function countKeywordMatches(message: string, keywords: string[]): number {
    if (!keywords || keywords.length === 0) return 0;

    const normalizedMessage = normalizeText(message);
    let matches = 0;

    for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedMessage.includes(normalizedKeyword)) {
            matches++;
        }
    }

    return matches;
}

/**
 * Select the best agent for handling a message
 * 
 * Priority:
 * 1. Agent with most keyword matches
 * 2. Agent with highest priority (tiebreaker)
 * 3. Default agent (isDefault: true)
 * 4. First active agent (oldest)
 */
export async function selectBestAgent(
    companyId: string,
    messageContent: string
): Promise<{ agent: { id: string; name: string } | null; reason: string }> {
    try {
        // Get all active agents for this company
        const agents = await prisma.aIAgent.findMany({
            where: {
                companyId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                triggerKeywords: true,
                priority: true,
                isDefault: true,
            },
            orderBy: { createdAt: "asc" },
        });

        if (agents.length === 0) {
            logger.debug("[AgentRouter] No active agents found");
            return { agent: null, reason: "no_agents" };
        }

        // If only one agent, use it
        if (agents.length === 1) {
            logger.debug("[AgentRouter] Single agent available", { agentId: agents[0].id });
            return { agent: agents[0], reason: "single_agent" };
        }

        // Calculate match score for each agent
        const candidates: AgentCandidate[] = agents.map(agent => ({
            ...agent,
            matchScore: countKeywordMatches(messageContent, agent.triggerKeywords),
        }));

        // Find agents with matches
        const matchedAgents = candidates.filter(a => a.matchScore > 0);

        if (matchedAgents.length > 0) {
            // Sort by matchScore DESC, then priority DESC
            matchedAgents.sort((a, b) => {
                if (b.matchScore !== a.matchScore) {
                    return b.matchScore - a.matchScore;
                }
                return b.priority - a.priority;
            });

            const selected = matchedAgents[0];
            logger.info("[AgentRouter] Agent selected by keywords", {
                agentId: selected.id,
                agentName: selected.name,
                matchScore: selected.matchScore,
                keywords: selected.triggerKeywords.filter(k =>
                    normalizeText(messageContent).includes(normalizeText(k))
                ),
            });

            return {
                agent: { id: selected.id, name: selected.name },
                reason: `keyword_match:${selected.matchScore}`
            };
        }

        // No keyword matches - use default agent
        const defaultAgent = candidates.find(a => a.isDefault);
        if (defaultAgent) {
            logger.debug("[AgentRouter] Using default agent", { agentId: defaultAgent.id });
            return { agent: { id: defaultAgent.id, name: defaultAgent.name }, reason: "default" };
        }

        // No default - use agent with highest priority
        const byPriority = [...candidates].sort((a, b) => b.priority - a.priority);
        const highestPriority = byPriority[0];

        logger.debug("[AgentRouter] Using highest priority agent", { agentId: highestPriority.id });
        return { agent: { id: highestPriority.id, name: highestPriority.name }, reason: "priority" };

    } catch (error) {
        logger.error("[AgentRouter] Error selecting agent", { error });
        return { agent: null, reason: "error" };
    }
}

/**
 * Get agent by ID with full data
 */
export async function getAgentById(agentId: string) {
    return prisma.aIAgent.findUnique({
        where: { id: agentId },
    });
}
