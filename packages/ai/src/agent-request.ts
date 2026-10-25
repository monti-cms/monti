import { z } from "zod";

/** Where the admin is when they ask: the agent reads it as context, and offers the editor tools only when an entry is open. */
export const agentContextSchema = z.object({
	/** The admin screen (`entries`, `entry`, `media`, `settings`, …), as the shell names it. */
	screen: z.string().trim().min(1).max(100),
	collection: z.string().max(100).optional(),
	entryId: z.string().max(100).optional(),
	selectedIds: z.array(z.string().max(100)).max(100).optional(),
});

export type AgentContext = z.output<typeof agentContextSchema>;

/**
 * A message of the conversation as the panel's `useChat` holds it. Only what the server reads is checked (the role and that parts have a type); the AI SDK
 * validates the parts when it turns them into model messages. A `system` message is not accepted: the system prompt is the server's alone.
 */
const messageSchema = z.looseObject({
	id: z.string().max(200),
	role: z.enum(["user", "assistant"]),
	parts: z.array(z.looseObject({ type: z.string().max(100) })).max(500),
});

/** Most messages one request carries. */
export const MAX_AGENT_MESSAGES = 200;

export const agentRequestSchema = z.object({
	/** The conversation to continue. Without it a new one starts; the answer's message metadata carries its id. */
	runId: z.string().min(1).max(100).optional(),
	/** The whole conversation so far, ending with what the admin just asked (or the result of an editor tool the browser answered). */
	messages: z.array(messageSchema).min(1).max(MAX_AGENT_MESSAGES),
	context: agentContextSchema,
});

export type AgentRequest = z.output<typeof agentRequestSchema>;

/** The list of conversations: newest first, paged. */
export const agentRunsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
