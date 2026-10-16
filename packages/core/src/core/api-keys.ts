import { z } from "zod";

/**
 * The central API key store as the admin API and the admin UI see it. Key values never appear here: a key is shown by its name and the last
 * characters of its value (`tail`), and the value goes in only when a key is added or replaced.
 */

/** One feature that uses a key (an AI connection, the spell checker, git sync). */
export interface ApiKeyUse {
	/** The plugin that uses the key (`ai`, `text-check-bareun`, `git-sync`). */
	readonly plugin: string;
	/** Which item of the plugin uses it (`connection:<id>`). Stable: it is what is stored, never text. */
	readonly ref: string;
	/** What the admin shows, worked out when the keys are read, in the admin's language and with the item's current name: `AI connection "Claude"`. */
	readonly label: string;
}

/** A key a plugin says it needs (`Plugin.keySlots`), with the key assigned to it. */
export interface ApiKeySlotView {
	readonly plugin: string;
	readonly slot: string;
	/** In the admin language. Display only. */
	readonly label: string;
	/** The service the key is for, in no language ("Bareun"): what a key entered for this slot is named. */
	readonly service: string;
	/** The assigned key (name and last characters only), or `null` when none is assigned yet. */
	readonly key: {
		readonly id: string;
		readonly name: string;
		readonly tail: string;
		readonly readable: boolean;
	} | null;
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
	/** Everything that uses the key: items of plugins (an AI connection) and the plugin key slots it is assigned to. */
	readonly uses: readonly ApiKeyUse[];
	/** The slots among `uses` (`ref` is the slot id). They can be cleared; the other uses are changed where they are made. */
	readonly slots: readonly ApiKeyUse[];
}

/** `GET /v1/api-keys`. */
export interface ApiKeyList {
	readonly items: readonly ApiKeyView[];
	/** Whether the server config has a `secret`. Without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	/** The keys the installed plugins ask for, assigned or not. */
	readonly slots: readonly ApiKeySlotView[];
}

/** `PUT /v1/api-keys/slots`: assigns a key to a plugin's slot (`none` clears it). A typed key is saved together with the assignment. */
export const assignKeySlotBodySchema = z.object({
	plugin: z.string().min(1).max(100),
	slot: z.string().min(1).max(100),
	key: z.discriminatedUnion("use", [
		z.object({ use: z.literal("saved"), keyId: z.string().min(1).max(100) }),
		z.object({ use: z.literal("new"), value: z.string().trim().min(1).max(1000) }),
		z.object({ use: z.literal("none") }),
	]),
});

export const API_KEY_NAME_MAX = 60;
export const API_KEY_VALUE_MAX = 1000;

const keyName = z.string().trim().min(1).max(API_KEY_NAME_MAX);
const keyValue = z.string().trim().min(1).max(API_KEY_VALUE_MAX);

export const createApiKeyBodySchema = z.object({ name: keyName, value: keyValue });

/** Rename, replace the value, or both. */
export const patchApiKeyBodySchema = z
	.object({ expectedVersion: z.number().int().min(1), name: keyName.optional(), value: keyValue.optional() })
	.refine((body) => body.name !== undefined || body.value !== undefined, { message: "Give a new name or a new value" });

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
 * The names a new key can get when its place picks one, in order: `base`, then `base 2`, `base 3`, ... (the store takes the first one that is free;
 * names are compared without regard to case).
 */
export function keyNameCandidate(base: string, attempt: number): string {
	const clean = base.trim().slice(0, API_KEY_NAME_MAX - 4) || "Key";
	return attempt <= 1 ? clean : `${clean} ${attempt}`;
}
