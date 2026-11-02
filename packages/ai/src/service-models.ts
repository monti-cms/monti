/**
 * The AI services a key can be for, as both the server and the admin read them. Every one is called through its OpenAI-compatible endpoint, so one
 * client serves them all. A key is a whole connection: the service gives the address (or the key carries one, for an OpenAI-compatible server of the
 * site's choosing), the models a conversation starts with, and which models can think.
 */

export const AI_SERVICE_IDS = ["anthropic", "openai", "openrouter", "google", "openai-compatible"] as const;
export type AiServiceId = (typeof AI_SERVICE_IDS)[number];

/** How much a model thinks before it answers (the reasoning effort). */
export const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

interface AiServiceDefinition {
	readonly id: AiServiceId;
	/** The OpenAI-compatible address, or `null` when the key carries one. */
	readonly baseUrl: string | null;
	/** The models a new conversation and the quick tasks start with, when the service has a sensible one. */
	readonly defaults: { readonly assistant: string; readonly quick: string } | null;
	/** Extra headers the service wants with every request (Anthropic reads its key from `x-api-key` on some routes). */
	readonly headers?: (key: string) => Record<string, string>;
	/** Whether a model of the service can think (takes a reasoning effort). */
	readonly thinks: (model: string) => boolean;
}

const SERVICES: Readonly<Record<AiServiceId, AiServiceDefinition>> = {
	anthropic: {
		id: "anthropic",
		baseUrl: "https://api.anthropic.com/v1",
		defaults: { assistant: "claude-sonnet-5-5", quick: "claude-haiku-5-5" },
		headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
		thinks: (model) => /^claude-(opus|sonnet|haiku)-(4|5)/.test(model),
	},
	openai: {
		id: "openai",
		baseUrl: "https://api.openai.com/v1",
		defaults: { assistant: "gpt-5", quick: "gpt-5-mini" },
		thinks: (model) => /^(gpt-5|o\d)/.test(model),
	},
	openrouter: {
		id: "openrouter",
		baseUrl: "https://openrouter.ai/api/v1",
		defaults: null,
		thinks: (model) => /(claude-(opus|sonnet|haiku)-(4|5)|gpt-5|\/o\d|gemini-2\.5|deepseek-r1)/.test(model),
	},
	google: {
		id: "google",
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		defaults: { assistant: "gemini-2.5-pro", quick: "gemini-2.5-flash" },
		thinks: (model) => /^gemini-2\.5/.test(model),
	},
	"openai-compatible": {
		id: "openai-compatible",
		baseUrl: null,
		defaults: null,
		thinks: () => false,
	},
};

export const isAiService = (id: string): id is AiServiceId => (AI_SERVICE_IDS as readonly string[]).includes(id);

/** Where the service is called for a key: its own address, or the one the key carries. */
export const serviceUrl = (service: AiServiceId, keyUrl: string): string =>
	(SERVICES[service].baseUrl ?? keyUrl).replace(/\/+$/, "");

export const serviceHeaders = (service: AiServiceId, key: string | null): Record<string, string> => ({
	...(key ? { Authorization: `Bearer ${key}` } : {}),
	...(key ? SERVICES[service].headers?.(key) : {}),
});

export const serviceDefaults = (service: AiServiceId) => SERVICES[service].defaults;

/** Whether a model can think. A model of an OpenAI-compatible server of the site's choosing is not known to. */
export const canThink = (service: AiServiceId, model: string): boolean => SERVICES[service].thinks(model);

/** The brand name of a service, for what the assistant says about it ("Anthropic is out of credit"); an OpenAI-compatible server has none. */
export const serviceName = (service: AiServiceId): string =>
	({ anthropic: "Anthropic", openai: "OpenAI", openrouter: "OpenRouter", google: "Google", "openai-compatible": "" })[
		service
	];
