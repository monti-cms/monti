/** A model a key can use, as the model menu lists it (docs 10 and 14). Only models that can call tools are listed: the assistant works through tools. */
export type Model = {
	id: string;
	/** The service's own name for it, when it gives one. */
	label?: string;
	/** It can think, so the menu offers a thinking level for it. */
	thinking: boolean;
	/** It reads pictures: writing alt text needs it. */
	images: boolean;
};

/** What a service answered when asked about a key: its models, or that it refused the key, or that it could not be reached. */
export type KeyCheck = { ok: true; models: Model[] } | { ok: false; reason: "refused" | "unreachable" };

export type KeyCredentials = { secret: string; baseUrl: string | null };

/**
 * A service a key is for (doc 14): how the key window asks for it, and the one request that tells whether the service takes the key. The core knows
 * the services by this shape only; a plugin adds its own the same way.
 */
export type KeyService = {
	/** Stored with the key: `anthropic`. */
	id: string;
	/** The service's name: the row in the service list, and a new key's name. */
	name: string;
	/** The key window asks for the service's address too (an OpenAI-compatible server). The key's name is then the address's host. */
	address?: boolean;
	/** The service may take no key at all (a server on the same machine). */
	keyOptional?: boolean;
	/** What a key of this service looks like, shown in the empty key field: `sk-ant-…`. */
	placeholder?: string;
	/**
	 * The models a site starts with before anyone picks, the assistant's and the quick tasks': each a list in order of preference, the first one the
	 * key can use wins. Services rename their models faster than Monti is released, so when none is there the key's first model stands in.
	 */
	defaults?: { assistant: string[]; quick: string[] };
	/** Asks the service once. Never throws: a refusal and a failure to reach it are answers. */
	check(credentials: KeyCredentials, fetch: typeof globalThis.fetch): Promise<KeyCheck>;
};

/** How long a service gets to answer about a key. */
const CHECK_MS = 10_000;

type Listed = { status: number; body: unknown };

/** One GET that answers JSON; `null` when the service cannot be reached or does not answer JSON. */
async function get(
	fetch: typeof globalThis.fetch,
	url: string,
	headers: Record<string, string>,
): Promise<Listed | null> {
	try {
		const response = await fetch(url, { headers, signal: AbortSignal.timeout(CHECK_MS) });
		return { status: response.status, body: await response.json().catch(() => null) };
	} catch {
		return null;
	}
}

const REFUSED = new Set([401, 403]);

/** Turns a service's answer into a check: a refused key, an unreachable service, or the rows `pick` reads the models from. */
function answer(
	listed: Listed | null,
	refused: (status: number) => boolean,
	pick: (body: unknown) => Model[],
): KeyCheck {
	if (!listed) return { ok: false, reason: "unreachable" };
	if (refused(listed.status)) return { ok: false, reason: "refused" };
	if (listed.status < 200 || listed.status >= 300) return { ok: false, reason: "unreachable" };
	return { ok: true, models: pick(listed.body).sort((a, b) => a.id.localeCompare(b.id)) };
}

const rows = (body: unknown, key: string): Record<string, unknown>[] => {
	const list = (body as Record<string, unknown> | null)?.[key];
	return Array.isArray(list) ? list.filter((row) => typeof row === "object" && row !== null) : [];
};

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

const supported = (capabilities: unknown, name: string) =>
	((capabilities as Record<string, { supported?: unknown }> | undefined)?.[name]?.supported ?? false) === true;

const bearer = (secret: string): Record<string, string> => (secret ? { authorization: `Bearer ${secret}` } : {});

/** OpenAI lists every kind of model under one address; these are not ones a conversation can be held with. */
const NOT_CHAT = /audio|realtime|tts|transcribe|whisper|image|dall-e|embedding|moderation|search|instruct|codex|sora/;

const anthropic: KeyService = {
	id: "anthropic",
	name: "Anthropic",
	placeholder: "sk-ant-…",
	defaults: { assistant: ["claude-sonnet-5-5", "claude-opus-5-5"], quick: ["claude-haiku-5-5"] },
	async check({ secret }, fetch) {
		const listed = await get(fetch, "https://api.anthropic.com/v1/models?limit=1000", {
			"x-api-key": secret,
			"anthropic-version": "2026-10-21",
		});
		return answer(
			listed,
			(status) => REFUSED.has(status),
			(body) =>
				rows(body, "data").flatMap((row) => {
					const id = text(row.id);
					if (!id) return [];
					return [
						{
							id,
							label: text(row.display_name),
							thinking: supported(row.capabilities, "thinking"),
							images: supported(row.capabilities, "image_input"),
						},
					];
				}),
		);
	},
};

const openai: KeyService = {
	id: "openai",
	name: "OpenAI",
	placeholder: "sk-…",
	// Unverified: these ids were not checked against OpenAI's own list (that needs a key); they are read off OpenRouter's public list. A key that
	// lists none of them starts with its first model, which the tests cover.
	defaults: { assistant: ["gpt-5.5", "gpt-5.4", "gpt-5"], quick: ["gpt-5.4-mini", "gpt-5-mini"] },
	async check({ secret }, fetch) {
		const listed = await get(fetch, "https://api.openai.com/v1/models", bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			// The list says nothing of what a model can do, so the names decide: the chat families, and of those the ones that reason.
			(body) =>
				rows(body, "data").flatMap((row) => {
					const id = text(row.id);
					if (!id || !/^(gpt-|o\d|chatgpt-)/.test(id) || NOT_CHAT.test(id)) return [];
					return [{ id, thinking: /^(o\d|gpt-5)/.test(id), images: !/^(gpt-3|o1-mini|o3-mini)/.test(id) }];
				}),
		);
	},
};

const openrouter: KeyService = {
	id: "openrouter",
	name: "OpenRouter",
	placeholder: "sk-or-…",
	defaults: { assistant: ["anthropic/claude-sonnet-5.5"], quick: ["anthropic/claude-haiku-5.5"] },
	async check({ secret }, fetch) {
		// Its model list is open to anyone, so the key is asked about on its own first.
		const key = await get(fetch, "https://openrouter.ai/api/v1/key", bearer(secret));
		const taken = answer(
			key,
			(status) => REFUSED.has(status),
			() => [],
		);
		if (!taken.ok) return taken;
		const listed = await get(fetch, "https://openrouter.ai/api/v1/models", bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			(body) =>
				rows(body, "data").flatMap((row) => {
					const id = text(row.id);
					const can = Array.isArray(row.supported_parameters) ? row.supported_parameters : [];
					// A ":batch" id is the same model answered later and cheaper: not one to talk with.
					if (!id || id.endsWith(":batch") || !can.includes("tools")) return [];
					const reads = (row.architecture as { input_modalities?: unknown } | undefined)?.input_modalities;
					return [
						{
							id,
							label: text(row.name),
							thinking: can.includes("reasoning"),
							images: Array.isArray(reads) && reads.includes("image"),
						},
					];
				}),
		);
	},
};

const gemini: KeyService = {
	id: "gemini",
	name: "Google",
	placeholder: "AIza…",
	// Unverified, as OpenAI's above: read off OpenRouter's public list, not Google's own. The same fallback holds.
	defaults: {
		assistant: ["gemini-3.1-pro-preview", "gemini-3.8-flash"],
		quick: ["gemini-3.8-flash", "gemini-3.5-flash"],
	},
	async check({ secret }, fetch) {
		const listed = await get(fetch, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
			"x-goog-api-key": secret,
		});
		return answer(
			listed,
			// Google answers a key it does not know with 400.
			(status) => status === 400 || REFUSED.has(status),
			(body) =>
				rows(body, "models").flatMap((row) => {
					const id = text(row.name)?.replace(/^models\//, "");
					const does = Array.isArray(row.supportedGenerationMethods) ? row.supportedGenerationMethods : [];
					if (!id?.startsWith("gemini-") || !does.includes("generateContent") || NOT_CHAT.test(id)) return [];
					return [{ id, label: text(row.displayName), thinking: row.thinking === true, images: true }];
				}),
		);
	},
};

const compatible: KeyService = {
	id: "openai-compatible",
	name: "OpenAI-compatible",
	address: true,
	keyOptional: true,
	async check({ secret, baseUrl }, fetch) {
		if (!baseUrl) return { ok: false, reason: "unreachable" };
		const listed = await get(fetch, `${baseUrl.replace(/\/+$/, "")}/models`, bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			// Such a server says nothing of its models: each is taken to call tools, and none to think or read pictures.
			(body) =>
				rows(body, "data").flatMap((row) => {
					const id = text(row.id);
					return id ? [{ id, thinking: false, images: false }] : [];
				}),
		);
	},
};

/** The AI services Monti knows without a plugin (doc 14). The model lists and the assistant's models come from keys of these. */
export const aiServices: readonly KeyService[] = [anthropic, openai, openrouter, gemini, compatible];
