import { z } from "zod";

/**
 * The central API key store as the admin API and the admin UI see it. Key values never appear here: a key is shown by its name and the last
 * characters of its value (`tail`), and the value goes in only when a key is added or replaced.
 */

/** One feature that uses a key (an AI connection, the spell checker, git sync). */
export interface ApiKeyUse {
	/** The plugin that uses the key (`ai`, `text-check-bareun`, `git-sync`). */
	readonly plugin: string;
	/** Which place of the plugin uses it. Unique within the plugin. */
	readonly slot: string;
	/** What the admin shows, in the admin's language: `AI connection "Claude"`. */
	readonly label: string;
}

export interface ApiKeyView {
	readonly id: string;
	readonly name: string;
	/** The last four characters of the value, or empty when the value is too short to show any of it safely. */
	readonly tail: string;
	/** `false` when the value cannot be decrypted (the server `secret` changed without listing the old one in `previousSecrets`). */
	readonly readable: boolean;
	readonly version: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly uses: readonly ApiKeyUse[];
}

/** `GET /v1/api-keys`. */
export interface ApiKeyList {
	readonly items: readonly ApiKeyView[];
	/** Whether the server config has a `secret`. Without one nothing can be saved. */
	readonly secretsAvailable: boolean;
}

export const API_KEY_NAME_MAX = 60;
export const API_KEY_VALUE_MAX = 1000;

const keyName = z.string().trim().min(1).max(API_KEY_NAME_MAX);
const keyValue = z.string().trim().min(1).max(API_KEY_VALUE_MAX);

export const createApiKeyBodySchema = z.object({ name: keyName, value: keyValue });
export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;

/** Rename, replace the value, or both. */
export const patchApiKeyBodySchema = z
	.object({ expectedVersion: z.number().int().min(1), name: keyName.optional(), value: keyValue.optional() })
	.refine((body) => body.name !== undefined || body.value !== undefined, { message: "Give a new name or a new value" });
export type PatchApiKeyBody = z.infer<typeof patchApiKeyBodySchema>;

/**
 * What a form sends for the key of one place: a key of the store (`saved`), a value to save into the store as a new key named after the place (`new`), or
 * no key (`none`). The plugin's route passes it to `cms.apiKeys.choose`.
 */
export const apiKeyChoiceSchema = z.discriminatedUnion("use", [
	z.object({ use: z.literal("saved"), keyId: z.string().min(1).max(100) }),
	z.object({ use: z.literal("new"), value: keyValue }),
	z.object({ use: z.literal("none") }),
]);
export type ApiKeyChoiceInput = z.infer<typeof apiKeyChoiceSchema>;

/**
 * The name a new key gets when its place picks one: `base`, or `base 2`, `base 3`, ... when that name is taken (names are compared without regard to case).
 */
export function freeKeyName(base: string, taken: Iterable<string>): string {
	const used = new Set([...taken].map((name) => name.toLowerCase()));
	const clean = base.trim().slice(0, API_KEY_NAME_MAX - 4) || "Key";
	if (!used.has(clean.toLowerCase())) return clean;
	for (let n = 2; ; n++) {
		const candidate = `${clean} ${n}`;
		if (!used.has(candidate.toLowerCase())) return candidate;
	}
}
