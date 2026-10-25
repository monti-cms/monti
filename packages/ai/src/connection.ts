import { apiKeyChoiceSchema } from "@monti-cms/core/site";
import { z } from "zod";

/**
 * AI service connections. Several are saved in the admin AI screen's Connections tab, and each action picks which connection's which model to use.
 *
 * - Generation (`chat`): an OpenAI-compatible address (`…/v1`). OpenRouter, OpenCode Go, Gemini, xAI, etc.
 * - Decisions (`decisions`): a System One model that assigns a probability to each choice (e.g. Jev). Addresses like TypeSafe `…/v1/systemone`,
 *   OpenRouter `…/api/alpha/decisions`. Both use the `state`, `model`, `questions` -> `answers` shape.
 *
 * Keys live in the central API key store (Tools → API keys); a connection only refers to one, and only the last four characters are shown on screen. Both server and browser use this file.
 */

export const AI_PROVIDER_KINDS = ["chat", "decisions"] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

/** Per-kind address and model examples (placeholder text of the input fields). */
export const PROVIDER_EXAMPLES: Record<AiProviderKind, { url: string; model: string }> = {
	chat: { url: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
	decisions: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-latest" },
};

const url = z.union([z.literal(""), z.string().trim().url().max(500)]);

export const aiProviderInputSchema = z.object({
	name: z.string().trim().min(1).max(60),
	kind: z.enum(AI_PROVIDER_KINDS),
	url,
	/** The key to use: a saved key, a typed one (saved into the key store, named after the connection), or none. If omitted, the connection keeps its key. */
	key: apiKeyChoiceSchema.optional(),
	/** The model used when the action does not choose one. */
	defaultModel: z.string().trim().max(200),
});

export type AiProviderInput = z.output<typeof aiProviderInputSchema>;

/** Request to add or edit a connection. Conflicts are prevented by the version of the whole config (0 for the first time). */
export const aiProviderRequestSchema = z.object({
	expectedVersion: z.number().int().min(0),
	provider: aiProviderInputSchema,
});

/** The model the admin agent runs on. When none is set, the agent uses the first ready chat connection with its default model. */
export const aiAgentSettingSchema = z.object({
	providerId: z.string().min(1).max(60),
	model: z.string().trim().min(1).max(200),
});

export type AiAgentSetting = z.output<typeof aiAgentSettingSchema>;

/** Request to choose the agent's model (`null`: back to the default). */
export const aiAgentRequestSchema = z.object({
	expectedVersion: z.number().int().min(0),
	agent: aiAgentSettingSchema.nullable(),
});

/** A connection sent to the screen. Has only the last four characters instead of the key. */
export interface AiProviderView {
	id: string;
	name: string;
	kind: AiProviderKind;
	url: string;
	/** The key in the API key store this connection uses (name and last four characters only), or `null`. */
	key: { id: string; name: string; tail: string; readable: boolean } | null;
	defaultModel: string;
	/** Is it usable, i.e. address, key and default model are all present? */
	ready: boolean;
	/** For each model the connection check has tried: did it call a tool? The admin agent needs that. Models never checked are not listed. */
	toolSupport: Record<string, boolean>;
}

/** The model the admin agent would run on now, and whether it is known to call tools (`null`: never checked). */
export interface AiAgentModelView {
	providerId: string;
	providerName: string;
	model: string;
	tools: boolean | null;
}

export interface AiAgentView {
	/** What the admin chose, or `null` for the default. */
	setting: AiAgentSetting | null;
	/** What the agent would use now (the choice, or the first ready chat connection with its default model), or `null` when nothing is usable. */
	effective: AiAgentModelView | null;
}

export interface AiSettingsView {
	version: number;
	providers: AiProviderView[];
	agent: AiAgentView;
	/** Using the fake development connection (`CMS_AI_FAKE=1`). All actions work regardless of the config. */
	fake: boolean;
}

/** Connection check before saving. If `providerId` is given, that connection's key is used when no new key is entered. */
export const aiProviderCheckSchema = z.object({
	providerId: z.string().max(60).optional(),
	/** The name is not used for the check, so it may be empty. */
	provider: aiProviderInputSchema.extend({ name: z.string().max(60) }),
});

export const aiModelsQuerySchema = z.object({
	/** List of saved connections. The server fills in the address and key. */
	providerId: z.string().max(60).optional(),
	/** When fetching the list with an address that is not yet saved. */
	url: url.optional(),
	/** A key of the store to use, or a typed one that is not saved yet. */
	keyId: z.string().max(100).optional(),
	apiKey: z.string().trim().min(1).max(1000).optional(),
});

export interface AiModelInfo {
	id: string;
	name?: string;
}

/** `tools`: whether the model called the check's tool (`null`: the probe failed for another reason, so nothing is known). Only chat connections have it. */
export type AiCheckResult =
	| { ok: true; ms: number; model: string; tools?: boolean | null }
	| { ok: false; message: string };
