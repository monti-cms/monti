import { z } from "zod";
import { type AiServiceId, THINKING_LEVELS } from "./service-models";

/**
 * What the AI plugin calls a model with. A key of an AI service (Tools › API keys) is the whole connection; a model is picked per use: in the chat
 * input for each conversation (with a thinking level), and once for the quick tasks (summary, tags, alt text, translation fill). Both server and browser
 * use this file.
 */

/** A model of one key. */
export const aiModelChoiceSchema = z.object({
	keyId: z.string().min(1).max(100),
	model: z.string().trim().min(1).max(200),
});
export type AiModelChoice = z.output<typeof aiModelChoiceSchema>;

export const thinkingSchema = z.enum(THINKING_LEVELS);

/** The model a conversation runs on: a model of one key, and how much it thinks (`off` for a model that cannot). */
export const agentModelSchema = aiModelChoiceSchema.extend({ thinking: thinkingSchema.default("off") });
export type AgentModelChoice = z.output<typeof agentModelSchema>;

/** `PUT /v1/ai/settings`: chooses the quick-task model. */
export const aiQuickRequestSchema = z.object({
	expectedVersion: z.number().int().min(0),
	quick: aiModelChoiceSchema,
});

/** The days a conversation nobody opened is kept, as the past conversations offer them; `null` keeps every conversation. */
export const UNOPENED_DAYS = [7, 30, 90] as const;
/** What a site that never chose keeps unopened conversations for. */
export const DEFAULT_UNOPENED_DAYS = 30;
export const unopenedDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]);
export type UnopenedDays = z.output<typeof unopenedDaysSchema>;

/** `PUT /v1/ai/settings`: how long a conversation nobody opened is kept. */
export const aiUnopenedRequestSchema = z.object({
	expectedVersion: z.number().int().min(0),
	unopenedDays: unopenedDaysSchema,
});

/** A key of an AI service, as the model menus list it. */
export interface AiKeyView {
	id: string;
	name: string;
	service: AiServiceId;
	/** Its value can be read (the server secret did not change under it). */
	ready: boolean;
}

/** A model choice with the name of its key, for display. */
export interface AiModelView extends AiModelChoice {
	keyName: string;
}

export interface AiSettingsView {
	version: number;
	/** The keys of AI services, by name. */
	keys: AiKeyView[];
	/** The model the quick tasks use: the one chosen, or the service's default of the first key that has one. `null` when there is none. */
	quick: AiModelView | null;
	/** The model a new conversation starts with: the service's default of the first key that has one. `null` when there is none. */
	assistant: AiModelView | null;
	/** For each key, the models found to call tools (`true`) or not (`false`). Models never tried are not listed. */
	toolSupport: Record<string, Record<string, boolean>>;
	/** Using the fake development model (`CMS_AI_FAKE=1`). Everything works without a key. */
	fake: boolean;
	/** Days a conversation nobody opened is kept before it is deleted; `null` keeps them all. */
	unopenedDays: UnopenedDays;
}

/** `POST /v1/ai/models`: the models of one key. */
export const aiModelsQuerySchema = z.object({ keyId: z.string().min(1).max(100) });

export interface AiModelInfo {
	id: string;
	name?: string;
}

/**
 * What a conversation's stream says when the service refused for lack of credit, instead of the service's words: the panel shows its own notice with
 * the key and "Send with another model".
 */
export const CREDIT_EXHAUSTED = "credit_exhausted";
