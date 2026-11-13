/** A model a key can use, as the model menu lists it (docs 10 and 14). Only models that can call tools are listed: the assistant works through tools. */
export type Model = {
	id: string;
	/** The service's own name for it, when it gives one. */
	label?: string;
	/** It can think, so the menu offers a thinking level for it. */
	thinking: boolean;
	/** It reads pictures: writing alt text needs it. */
	images: boolean;
	/** How many tokens it takes in at once (its context window), when its service says. The assistant sizes what it sends by it. */
	context?: number;
};

/** What a service answered when asked about a key: its models, or that it refused the key, or that it could not be reached. */
export type KeyCheck = { ok: true; models: Model[] } | { ok: false; reason: "refused" | "unreachable" };

export type KeyCredentials = { secret: string; baseUrl: string | null };

/** What a check works with: the server's `fetch`, and the signal that ends the whole check when its time is up. */
export type KeyCheckTools = { fetch: typeof globalThis.fetch; signal: AbortSignal };

/**
 * A service a key is for (doc 14): how the key window asks for it, and the one check that tells whether the service takes the key. The core knows
 * the services by this shape only; a plugin adds its own the same way. A check is run through {@link checkKey}, never called on its own.
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
	/** Asks the service. A refusal and a failure to reach it are answers; it passes `tools.signal` to every request it makes. */
	check(credentials: KeyCredentials, tools: KeyCheckTools): Promise<KeyCheck>;
};

/**
 * From this length on a key is treated as a secret worth guarding by its text: its last four characters are shown, and a model name that contains
 * it is refused. Shorter ones are placeholders ("x", "none", "ollama") in front of servers that take no key.
 */
export const KEY_LENGTH_THAT_MATTERS = 12;

/** How long a service gets to answer about a key: one deadline for the whole check, however many requests it makes. */
export const CHECK_MS = 10_000;

/** The most a service's answer may weigh. The longest list today (OpenRouter's, some 470 models) is under one megabyte. */
export const MOST_ANSWER_BYTES = 8 * 1024 * 1024;

const UNREACHABLE: KeyCheck = { ok: false, reason: "unreachable" };

/** A 2xx answer whose body could not be used: over the size limit, or not JSON. */
const UNREADABLE = Symbol("unreadable");

type Listed = { status: number; body: unknown };

/** The answer's JSON, read up to {@link MOST_ANSWER_BYTES} and no further: a service cannot make the server hold whatever it sends. */
async function limitedJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) return UNREADABLE;
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > MOST_ANSWER_BYTES) {
			await reader.cancel().catch(() => {});
			return UNREADABLE;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.length;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return UNREADABLE;
	}
}

/**
 * A fetch that never follows a redirect, whatever its caller asks for: a key sent in a header would go with the redirect to wherever the service
 * points, another origin or a machine inside the server's network. Every request that carries a key goes through one: the checks of the keys
 * (the built-in services' and a plugin's alike) and the assistant's calls to the model services.
 */
export function withoutRedirects(fetch: typeof globalThis.fetch): typeof globalThis.fetch {
	return (input, init) => fetch(input, { ...init, redirect: "error" });
}

/**
 * Where each built-in service is called. Named here once: the keys are checked there, and the assistant calls the models there and nowhere else
 * (a provider library that reads an address from the environment is given this one instead).
 */
export const SERVICE_URLS = {
	anthropic: "https://api.anthropic.com/v1",
	openai: "https://api.openai.com/v1",
	openrouter: "https://openrouter.ai/api/v1",
	gemini: "https://generativelanguage.googleapis.com/v1beta",
} as const;

/**
 * One GET; `null` when the service cannot be reached. A redirect is not followed: the key's headers would go with it to wherever the service points,
 * another origin or a machine inside the server's network. Only a 2xx answer's body is read.
 */
async function get(tools: KeyCheckTools, url: string, headers: Record<string, string>): Promise<Listed | null> {
	try {
		const response = await tools.fetch(url, { headers, signal: tools.signal, redirect: "error" });
		if (response.status < 200 || response.status >= 300) {
			await response.body?.cancel().catch(() => {});
			return { status: response.status, body: UNREADABLE };
		}
		return { status: response.status, body: await limitedJson(response) };
	} catch {
		return null;
	}
}

const REFUSED = new Set([401, 403]);

/**
 * Turns a service's answer into a check: a refused key, an unreachable service, or the models `pick` reads. An answer `pick` cannot read (`null`: not
 * the shape the service documents) counts as unreachable, so a page of HTML or a stray object never passes for "this key has no models".
 */
function answer(
	listed: Listed | null,
	refused: (status: number) => boolean,
	pick: (body: unknown) => Model[] | null,
): KeyCheck {
	if (!listed) return UNREACHABLE;
	if (refused(listed.status)) return { ok: false, reason: "refused" };
	if (listed.status < 200 || listed.status >= 300 || listed.body === UNREADABLE) return UNREACHABLE;
	const models = pick(listed.body);
	return models ? { ok: true, models } : UNREACHABLE;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The models of a list answer: `body[key]` must be a list of objects, and `read` turns each into a model, into `undefined` for a row that is not a
 * model to list (it cannot call tools), or into `null` for a row that is not what the service documents (no id). One such row makes the whole answer
 * unreadable.
 */
function listOf(
	body: unknown,
	key: string,
	read: (row: Record<string, unknown>) => Model | undefined | null,
): Model[] | null {
	const list = isObject(body) ? body[key] : undefined;
	if (!Array.isArray(list)) return null;
	const models: Model[] = [];
	for (const row of list) {
		const model = isObject(row) ? read(row) : null;
		if (model === null) return null;
		if (model) models.push(model);
	}
	return models;
}

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

const supported = (capabilities: unknown, name: string) =>
	((capabilities as Record<string, { supported?: unknown }> | undefined)?.[name]?.supported ?? false) === true;

const bearer = (secret: string): Record<string, string> => (secret ? { authorization: `Bearer ${secret}` } : {});

/** OpenAI lists every kind of model under one address; these are not ones a conversation can be held with. */
const NOT_CHAT = /audio|realtime|tts|transcribe|whisper|image|dall-e|embedding|moderation|search|instruct|codex|sora/;

/**
 * Whether an OpenAI model thinks, by its name: the `o` families, and GPT from 5 on. A guess: OpenAI's list says nothing of what a model can do. Where a
 * service does say (Anthropic, OpenRouter, Google), its own answer is used and no name is read.
 */
const openaiThinks = (id: string) => /^o\d/.test(id) || Number(/^gpt-(\d+)/.exec(id)?.[1] ?? 0) >= 5;

const anthropic: KeyService = {
	id: "anthropic",
	name: "Anthropic",
	placeholder: "sk-ant-…",
	defaults: { assistant: ["claude-sonnet-5-5", "claude-opus-5-5"], quick: ["claude-haiku-5-5"] },
	async check({ secret }, tools) {
		// The version Anthropic's API reference writes in its Models examples; the reference says the Models endpoint answers `2026-10-21` exactly as
		// it answers `2023-06-01`. Taken by the live API with a real key (T161, 2026-11-13).
		const listed = await get(tools, `${SERVICE_URLS.anthropic}/models?limit=1000`, {
			"x-api-key": secret,
			"anthropic-version": "2026-10-21",
		});
		return answer(
			listed,
			(status) => REFUSED.has(status),
			(body) =>
				listOf(body, "data", (row) => {
					const id = text(row.id);
					if (!id) return null;
					return {
						id,
						label: text(row.display_name),
						thinking: supported(row.capabilities, "thinking"),
						images: supported(row.capabilities, "image_input"),
						// The field the Models API's model object names; read when it is there (the live API gave it for every model, T161).
						context: tokens(row.max_input_tokens),
					};
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
	async check({ secret }, tools) {
		const listed = await get(tools, `${SERVICE_URLS.openai}/models`, bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			// The list says nothing of what a model can do, so the names decide: the chat families, and of those the ones that think.
			(body) =>
				listOf(body, "data", (row) => {
					const id = text(row.id);
					if (!id) return null;
					if (!/^(gpt-|o\d|chatgpt-)/.test(id) || NOT_CHAT.test(id)) return undefined;
					return { id, thinking: openaiThinks(id), images: !/^(gpt-3|o1-mini|o3-mini)/.test(id) };
				}),
		);
	},
};

const openrouter: KeyService = {
	id: "openrouter",
	name: "OpenRouter",
	placeholder: "sk-or-…",
	defaults: { assistant: ["anthropic/claude-sonnet-5.5"], quick: ["anthropic/claude-haiku-5.5"] },
	async check({ secret }, tools) {
		// Its model list is open to anyone, so the key is asked about on its own first. Both requests share the check's one deadline.
		const key = await get(tools, `${SERVICE_URLS.openrouter}/key`, bearer(secret));
		const taken = answer(
			key,
			(status) => REFUSED.has(status),
			(body) => (isObject(body) ? [] : null),
		);
		if (!taken.ok) return taken;
		const listed = await get(tools, `${SERVICE_URLS.openrouter}/models`, bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			(body) =>
				listOf(body, "data", (row) => {
					const id = text(row.id);
					if (!id) return null;
					const can = Array.isArray(row.supported_parameters) ? row.supported_parameters : [];
					// A ":batch" id is the same model answered later and cheaper: not one to talk with.
					if (id.endsWith(":batch") || !can.includes("tools")) return undefined;
					const reads = (row.architecture as { input_modalities?: unknown } | undefined)?.input_modalities;
					return {
						id,
						label: text(row.name),
						thinking: can.includes("reasoning"),
						images: Array.isArray(reads) && reads.includes("image"),
						context: tokens(row.context_length),
					};
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
	async check({ secret }, tools) {
		const listed = await get(tools, `${SERVICE_URLS.gemini}/models?pageSize=1000`, {
			"x-goog-api-key": secret,
		});
		return answer(
			listed,
			// Google answers a key it does not know with 400.
			(status) => status === 400 || REFUSED.has(status),
			(body) =>
				listOf(body, "models", (row) => {
					const id = text(row.name)?.replace(/^models\//, "");
					if (!id) return null;
					const does = Array.isArray(row.supportedGenerationMethods) ? row.supportedGenerationMethods : [];
					if (!id.startsWith("gemini-") || !does.includes("generateContent") || NOT_CHAT.test(id)) return undefined;
					return {
						id,
						label: text(row.displayName),
						thinking: row.thinking === true,
						images: true,
						context: tokens(row.inputTokenLimit),
					};
				}),
		);
	},
};

const compatible: KeyService = {
	id: "openai-compatible",
	name: "OpenAI-compatible",
	address: true,
	keyOptional: true,
	async check({ secret, baseUrl }, tools) {
		if (!baseUrl) return UNREACHABLE;
		const listed = await get(tools, `${baseUrl.replace(/\/+$/, "")}/models`, bearer(secret));
		return answer(
			listed,
			(status) => REFUSED.has(status),
			// Such a server says nothing of its models: each is taken to call tools, and none to think or read pictures.
			(body) =>
				listOf(body, "data", (row) => {
					const id = text(row.id);
					return id ? { id, thinking: false, images: false } : null;
				}),
		);
	},
};

/** The AI services Monti knows without a plugin (doc 14). The model lists and the assistant's models come from keys of these. */
export const aiServices: readonly KeyService[] = [anthropic, openai, openrouter, gemini, compatible];

/** A count of tokens a service gave: a whole number above zero, or nothing. */
const tokens = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;

/**
 * A model as it is stored: the things the menu and the assistant read (its id, its name, whether it thinks and reads pictures, how much it
 * takes in) and nothing else a service put in. `null` for one that is not a model.
 */
function plain(model: unknown): Model | null {
	if (!isObject(model) || typeof model.id !== "string" || model.id === "") return null;
	if (model.label !== undefined && typeof model.label !== "string") return null;
	if (typeof model.thinking !== "boolean" || typeof model.images !== "boolean") return null;
	const context = tokens(model.context);
	return {
		id: model.id,
		...(model.label ? { label: model.label } : {}),
		thinking: model.thinking,
		images: model.images,
		...(context === undefined ? {} : { context }),
	};
}

/**
 * Asks a service about a key: the one way a check is run, the core's services and a plugin's alike. It never throws, and holds what a single check
 * cannot be trusted with:
 * - one deadline ({@link CHECK_MS}) for the whole check, after which its requests are ended;
 * - the models are kept by their four known parts only, in the order of their ids, and a list that is not one counts as unreachable;
 * - an answer that carries the key itself (a server that names a model after the key it was sent) is refused whole: model names go to the assistant
 *   and into the activity log, where a key must never be. This holds for keys of {@link KEY_LENGTH_THAT_MATTERS} characters or more.
 */
export async function checkKey(
	service: KeyService,
	credentials: KeyCredentials,
	fetch: typeof globalThis.fetch,
): Promise<KeyCheck> {
	const deadline = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<KeyCheck>((resolve) => {
		timer = setTimeout(() => {
			deadline.abort();
			resolve(UNREACHABLE);
		}, CHECK_MS);
	});
	try {
		const checked: unknown = await Promise.race([
			// A plugin's check is someone else's code: it may throw before it returns a promise, or answer anything at all.
			Promise.resolve()
				// A plugin's check gets the same fetch the built-in ones use: it cannot be led along a redirect with the key either.
				.then(() => service.check(credentials, { fetch: withoutRedirects(fetch), signal: deadline.signal }))
				.catch(() => UNREACHABLE),
			late,
		]);
		if (!isObject(checked)) return UNREACHABLE;
		if (checked.ok === false) return checked.reason === "refused" ? { ok: false, reason: "refused" } : UNREACHABLE;
		if (checked.ok !== true || !Array.isArray(checked.models)) return UNREACHABLE;
		const models: Model[] = [];
		for (const listed of checked.models) {
			const model = plain(listed);
			if (!model) return UNREACHABLE;
			models.push(model);
		}
		const { secret } = credentials;
		// Only a key long enough to be one: "x" or "ollama" in front of a local server would be found in any model's name.
		if (
			secret.length >= KEY_LENGTH_THAT_MATTERS &&
			models.some((model) => model.id.includes(secret) || model.label?.includes(secret))
		)
			return UNREACHABLE;
		return { ok: true, models: models.sort((a, b) => a.id.localeCompare(b.id)) };
	} finally {
		clearTimeout(timer);
	}
}
