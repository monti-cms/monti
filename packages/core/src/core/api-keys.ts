import { z } from "zod";

/**
 * The central API key store as the admin API and the admin UI see it. Key values never appear here: a key is shown by its name and the last
 * characters of its value (`tail`), and the value goes in only when a key is added or replaced.
 *
 * A key is a whole connection: it names the service it is for (`service`, declared by a plugin's `keyServices`) and, for a service at an address of
 * the site's choosing, that address (`url`). Whoever needs the service uses a key of it.
 */

/** One feature that uses a key (the quick-task model, a plugin's key slot). */
export interface ApiKeyUse {
	/** The plugin that uses the key (`ai`, or the name of a plugin). */
	readonly plugin: string;
	/** Which item of the plugin uses it (`quick`, `slot:<id>`). Stable: it is what is stored, never text. */
	readonly ref: string;
	/** What the admin shows, worked out when the keys are read, in the admin's language: `Quick tasks`. */
	readonly label: string;
	/** What of the item the key serves, shown after the label (the model: `claude-haiku-5-5`). */
	readonly value?: string;
}

/** A service keys are for, as the admin lists it when a key is added (`ServerPlugin.keyServices`). */
export interface ApiKeyServiceView {
	/** Lowercase letters, digits and `-`, unique over all plugins (`anthropic`, `bareun`). */
	readonly id: string;
	/** In the admin language. */
	readonly label: string;
	/** Where the add dialog lists it: AI services first, then the ones plugins ask for. */
	readonly group: "ai" | "plugin";
	/** A short word after the label in the list (`Ollama`, the plugin's name). */
	readonly hint?: string;
	/** The service lives at an address the site chooses: the dialog asks for it, with this example. */
	readonly url?: { readonly placeholder: string };
	/** What a key of the service looks like, as the key field's placeholder (`sk-ant-…`). */
	readonly keyPlaceholder?: string;
	/** The service may need no key (a local model server). */
	readonly keyOptional?: boolean;
}

/** A key a plugin says it needs (`Plugin.keySlots`), with the key it uses. */
export interface ApiKeySlotView {
	readonly plugin: string;
	readonly slot: string;
	/** In the admin language. Display only. */
	readonly label: string;
	/** The id of the service the key is for. */
	readonly service: string;
	/**
	 * The key the plugin reads: the one chosen for the slot, or else the first key of the service. `null` when the service has no key. Name and last
	 * characters only.
	 */
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
	/** The id of the service the key is for. */
	readonly service: string;
	/** The address of the service, for a service at an address of the site's choosing; empty otherwise. */
	readonly url: string;
	/** The last four characters of the value, or empty when the value is too short to show any of it safely (or there is none). */
	readonly tail: string;
	/** `false` when the value cannot be decrypted (the server `secret` changed without listing the old one in `previousSecrets`). */
	readonly readable: boolean;
	/** Tokens the services counted for this key this month (UTC). */
	readonly usage: number;
	readonly version: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	/** Everything that uses the key: items of plugins (the quick-task model) and the plugin key slots that read it. */
	readonly uses: readonly ApiKeyUse[];
}

/** `GET /v1/api-keys`. */
export interface ApiKeyList {
	readonly items: readonly ApiKeyView[];
	/** Whether the server config has a `secret`. Without one nothing can be saved. */
	readonly secretsAvailable: boolean;
	/** The services keys can be added for, in the order the add dialog lists them. */
	readonly services: readonly ApiKeyServiceView[];
	/** The keys the installed plugins ask for, with the key each reads. */
	readonly slots: readonly ApiKeySlotView[];
}

/** `PUT /v1/api-keys/slots`: chooses which key of its service a plugin's slot reads (`null`: the first one again). */
export const assignKeySlotBodySchema = z.object({
	plugin: z.string().min(1).max(100),
	slot: z.string().min(1).max(100),
	keyId: z.string().min(1).max(100).nullable(),
});

export const API_KEY_NAME_MAX = 60;
export const API_KEY_VALUE_MAX = 1000;

const keyName = z.string().trim().min(1).max(API_KEY_NAME_MAX);
const keyValue = z.string().trim().min(1).max(API_KEY_VALUE_MAX);

/** `POST /v1/api-keys`. `url` is for a service at an address of the site's choosing; `value` may be left out only for a service that needs no key. */
export const createApiKeyBodySchema = z.object({
	service: z.string().min(1).max(100),
	url: z.string().trim().url().max(500).optional(),
	name: keyName,
	value: keyValue.optional(),
});

/** Rename, replace the value, or both. */
export const patchApiKeyBodySchema = z
	.object({ expectedVersion: z.number().int().min(1), name: keyName.optional(), value: keyValue.optional() })
	.refine((body) => body.name !== undefined || body.value !== undefined, { message: "Give a new name or a new value" });

/**
 * The name a new key of a service starts with: the service's label, or `label 2`, `label 3`, ... when keys already have it (names are compared
 * without regard to case).
 */
export function freeKeyName(base: string, taken: readonly string[]): string {
	const clean = base.trim().slice(0, API_KEY_NAME_MAX - 4) || "Key";
	const used = new Set(taken.map((name) => name.toLowerCase()));
	for (let attempt = 1; ; attempt++) {
		const candidate = attempt === 1 ? clean : `${clean} ${attempt}`;
		if (!used.has(candidate.toLowerCase())) return candidate;
	}
}
