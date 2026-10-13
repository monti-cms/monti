import { randomUUID } from "node:crypto";
import {
	type ApiKeyChoiceInput,
	type ApiKeySlotView,
	type ApiKeyUse,
	type ApiKeyView,
	freeKeyName,
} from "../core/api-keys";
import { CmsError } from "../core/store";
import type { PluginStorage, StorageItem } from "../plugin/storage";
import type { PluginSecrets } from "../secrets";

/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (`cms.secrets("core-keys")`, derived from the server config's `secret`). A plugin that needs a key keeps the key's id, not its value, reads the value
 * on the server when it calls the service (`read`), and tells the store where it uses the key (`setUses`) so the admin can show it and warn before a delete.
 *
 * The value is never part of a view and never leaves the server.
 */

/** Name of the core's storage and secrets scope. */
export const API_KEYS_SCOPE = "core-keys";
const KEYS = "keys";
const USES = "uses";
const SLOTS = "slots";

interface StoredKey {
	name: string;
	/** Encrypted value. */
	secret: string;
	tail: string;
}

/** A use is stored as a reference only (the key is `<plugin>:<ref>`); the text shown for it is worked out when the keys are read. */
interface StoredUse {
	keyId: string;
}

/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value: string): string => (value.length >= 12 ? value.slice(-4) : "");

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface ApiKeys {
	/** The keys the installed plugins ask for (`CmsPlugin.keySlots`), each with the key assigned to it or `null`. */
	slots(): Promise<ApiKeySlotView[]>;
	/**
	 * The value of the key assigned to a plugin's slot, for the server code that calls the service. `null` when no key is assigned, the key was deleted, or it cannot
	 * be decrypted. Never send it to a browser.
	 */
	readSlot(plugin: string, slot: string): Promise<string | null>;
	/** Assigns a saved key to a slot, or clears it with `null`. The slot must be one the plugin declared and installed. */
	setSlot(plugin: string, slot: string, keyId: string | null): Promise<void>;
	/**
	 * Assigns what a form chose to a slot: a saved key, a typed value saved as a new key (named `baseName`, `baseName 2`, ... when taken) in the same transaction as the
	 * assignment, or none (clears it). Either both are written or neither.
	 */
	assignSlot(plugin: string, slot: string, choice: ApiKeyChoiceInput, options: { baseName: string }): Promise<void>;
	/** Every key with the places that use it, by name. */
	list(): Promise<ApiKeyView[]>;
	get(id: string): Promise<ApiKeyView | null>;
	/** Whether keys can be saved (the server config has a `secret`). */
	readonly available: boolean;
	/** Saves a key under a name. A name another key has fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`. */
	add(input: { name: string; value: string }): Promise<ApiKeyView>;
	/** Saves a key under `baseName`, or `baseName 2`, `baseName 3`, ... when that name is taken. */
	addNamed(input: { baseName: string; value: string }): Promise<ApiKeyView>;
	/**
	 * Turns what a form sent for a place's key into the id to keep: the id of a saved key (which must exist), the id of a key just saved from the typed value
	 * (named `baseName`, or `baseName 2`, ... when taken), or `null` for no key.
	 */
	choose(choice: ApiKeyChoiceInput, options: { baseName: string }): Promise<string | null>;
	/** Renames and/or replaces the value. `expectedVersion` is the version read last; a different one fails with `conflict`. */
	update(id: string, input: { expectedVersion: number; name?: string; value?: string }): Promise<ApiKeyView>;
	/**
	 * Deletes a key and forgets where it was used. The plugins that used it keep its id and find no key behind it, so what used it stops working. The
	 * admin API asks for confirmation first when `uses` is not empty.
	 */
	remove(id: string, input: { expectedVersion: number }): Promise<void>;
	/** The value of a key, for the server code that calls a service with it. `null` if there is no such key or it cannot be decrypted. Never send it to a browser. */
	read(id: string): Promise<string | null>;
	/**
	 * Tells the store every item a plugin uses a key for (`ref`: a stable reference such as `connection:<id>`), replacing what it told before. An item that names a key
	 * that does not exist is left out. A plugin calls it whenever the items change (a connection is saved or deleted). Only references are stored: the text the admin shows
	 * comes from the plugin's `keyUses` when the keys are read, so it follows the admin language and the item's current name, and an item that no longer exists drops out.
	 */
	setUses(plugin: string, uses: readonly { ref: string; keyId: string }[]): Promise<void>;
}

export interface ApiKeysOptions {
	readonly storage: () => PluginStorage;
	readonly secrets: PluginSecrets;
	/**
	 * The text for each item of a plugin that uses keys, in the admin language (the plugin's `keyUses`). `null` for an item that does not exist any more: its
	 * use is dropped. A plugin that gives none is shown by its name.
	 */
	/** The slots the installed plugins declare (`CmsPlugin.keySlots`), with their labels in the admin language. */
	readonly declared?: () => readonly { readonly plugin: string; readonly slot: string; readonly label: string }[];
	/** Runs work in one transaction with the key store (`cms.transaction`). Without it a typed key and its assignment are written one after the other. */
	readonly atomic?: <T>(work: (keys: ApiKeys) => Promise<T>) => Promise<T>;
	readonly labels?: (plugin: string, refs: readonly string[]) => Promise<Readonly<Record<string, string | null>>>;
}

export function createApiKeys(options: ApiKeysOptions): ApiKeys {
	const { secrets } = options;
	const keys = () => options.storage().collection<StoredKey>(KEYS);
	const uses = () => options.storage().collection<StoredUse>(USES);
	const slotRows = () => options.storage().collection<StoredUse>(SLOTS);
	const declared = () => options.declared?.() ?? [];
	const slotId = (plugin: string, slot: string) => `${plugin}:${slot}`;

	interface KeyUses {
		uses: ApiKeyUse[];
		slots: ApiKeyUse[];
	}

	const usesByKey = async (): Promise<Map<string, KeyUses>> => {
		const rows = (await uses().list()).map((item) => {
			const at = item.key.indexOf(":");
			return { item, plugin: item.key.slice(0, at), ref: item.key.slice(at + 1) };
		});
		const byPlugin = new Map<string, string[]>();
		for (const { plugin, ref } of rows) byPlugin.set(plugin, [...(byPlugin.get(plugin) ?? []), ref]);
		const labels = new Map<string, Readonly<Record<string, string | null>>>();
		for (const [plugin, refs] of byPlugin) {
			labels.set(
				plugin,
				(await options.labels?.(plugin, refs).catch(() => undefined)) ??
					Object.fromEntries(refs.map((ref) => [ref, plugin])),
			);
		}
		const grouped = new Map<string, KeyUses>();
		const of = (keyId: string): KeyUses => {
			let found = grouped.get(keyId);
			if (!found) {
				found = { uses: [], slots: [] };
				grouped.set(keyId, found);
			}
			return found;
		};
		// A slot a key is assigned to is a use too (only of installed plugins: the declaration is what makes it a slot).
		for (const row of await slotRows().list()) {
			const place = declared().find((entry) => slotId(entry.plugin, entry.slot) === row.key);
			if (!place) continue;
			const use = { plugin: place.plugin, ref: place.slot, label: place.label };
			of(row.value.keyId).uses.push(use);
			of(row.value.keyId).slots.push(use);
		}
		for (const { item, plugin, ref } of rows) {
			const label = labels.get(plugin)?.[ref];
			if (label === null) {
				// The item is gone: forget the use.
				await uses()
					.delete(item.key, { expectedVersion: item.version })
					.catch(() => {});
				continue;
			}
			of(item.value.keyId).uses.push({ plugin, ref, label: label ?? plugin });
		}
		return grouped;
	};

	const view = (item: StorageItem<StoredKey>, found: KeyUses | undefined): ApiKeyView => ({
		id: item.key,
		name: item.value.name,
		tail: item.value.tail,
		readable: secrets.decrypt(item.value.secret) !== null,
		version: item.version,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString(),
		uses: found?.uses ?? [],
		slots: found?.slots ?? [],
	});

	const list = async (): Promise<ApiKeyView[]> => {
		const [items, places] = await Promise.all([keys().list(), usesByKey()]);
		return items
			.map((item) => view(item, places.get(item.key)))
			.sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
	};

	const assertNameFree = async (name: string, exceptId?: string) => {
		const clash = (await keys().list()).find((item) => item.key !== exceptId && sameName(item.value.name, name));
		if (clash) {
			throw new CmsError(`There is already a key named "${name}"; pick another name`, "key_name_taken");
		}
	};

	const create = async (name: string, value: string): Promise<ApiKeyView> => {
		const secret = secrets.encrypt(value);
		const item = await keys().set(randomUUID(), { name, secret, tail: tailOf(value) }, { expectedVersion: 0 });
		return view(item, undefined);
	};

	const api: ApiKeys = {
		list,
		get: async (id) => {
			const item = await keys().get(id);
			return item ? view(item, (await usesByKey()).get(id)) : null;
		},
		available: secrets.available,
		add: async ({ name, value }) => {
			await assertNameFree(name);
			return create(name, value);
		},
		addNamed: async ({ baseName, value }) => {
			const taken = (await keys().list()).map((item) => item.value.name);
			return create(freeKeyName(baseName, taken), value);
		},
		choose: async (choice, { baseName }) => {
			if (choice.use === "none") return null;
			if (choice.use === "saved") {
				if (!(await keys().get(choice.keyId))) {
					throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input");
				}
				return choice.keyId;
			}
			return (await api.addNamed({ baseName, value: choice.value })).id;
		},
		update: async (id, { expectedVersion, name, value }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			if (name !== undefined && !sameName(name, current.value.name)) await assertNameFree(name, id);
			const next: StoredKey = {
				name: name ?? current.value.name,
				secret: value === undefined ? current.value.secret : secrets.encrypt(value),
				tail: value === undefined ? current.value.tail : tailOf(value),
			};
			const saved = await keys().set(id, next, { expectedVersion });
			return view(saved, (await usesByKey()).get(id));
		},
		remove: async (id, { expectedVersion }) => {
			await keys().delete(id, { expectedVersion });
			for (const item of await uses().list()) {
				if (item.value.keyId === id) await uses().delete(item.key, { expectedVersion: item.version });
			}
			for (const item of await slotRows().list()) {
				if (item.value.keyId === id) await slotRows().delete(item.key, { expectedVersion: item.version });
			}
		},
		slots: async () => {
			const assigned = new Map((await slotRows().list()).map((row) => [row.key, row.value.keyId]));
			const all = new Map((await list()).map((key) => [key.id, key]));
			return declared().map((entry) => {
				const key = all.get(assigned.get(slotId(entry.plugin, entry.slot)) ?? "");
				return {
					plugin: entry.plugin,
					slot: entry.slot,
					label: entry.label,
					key: key ? { id: key.id, name: key.name, tail: key.tail, readable: key.readable } : null,
				};
			});
		},
		readSlot: async (plugin, slot) => {
			const row = await slotRows().get(slotId(plugin, slot));
			return row ? api.read(row.value.keyId) : null;
		},
		setSlot: async (plugin, slot, keyId) => {
			if (!declared().some((entry) => entry.plugin === plugin && entry.slot === slot)) {
				throw new CmsError(`The plugin "${plugin}" has no key slot "${slot}" (is it installed?)`, "not_found");
			}
			const id = slotId(plugin, slot);
			const current = await slotRows().get(id);
			if (keyId === null) {
				if (current) await slotRows().delete(id, { expectedVersion: current.version });
				return;
			}
			if (!(await keys().get(keyId)))
				throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input");
			await slotRows().set(id, { keyId }, { expectedVersion: current?.version ?? 0 });
		},
		assignSlot: async (plugin, slot, choice, { baseName }) => {
			const run = async (keysApi: ApiKeys) => keysApi.setSlot(plugin, slot, await keysApi.choose(choice, { baseName }));
			await (options.atomic ? options.atomic(run) : run(api));
		},
		read: async (id) => {
			const item = await keys().get(id);
			return item ? secrets.decrypt(item.value.secret) : null;
		},
		setUses: async (plugin, places) => {
			const existing = new Set((await keys().list()).map((item) => item.key));
			const wanted = new Map(
				places.filter((place) => existing.has(place.keyId)).map((place) => [`${plugin}:${place.ref}`, place]),
			);
			const current = await uses().list({ prefix: `${plugin}:` });
			for (const item of current) {
				if (!wanted.has(item.key)) await uses().delete(item.key, { expectedVersion: item.version });
			}
			const versions = new Map(current.map((item) => [item.key, item.version]));
			for (const [key, place] of wanted) {
				await uses().set(key, { keyId: place.keyId }, { expectedVersion: versions.get(key) ?? 0 });
			}
		},
	};
	return api;
}

/**
 * `monti db:migrate`: uses written before only references were stored carry the text they were saved with (`label`). Takes it off, so nothing frozen in the language
 * of the moment is kept; the text is worked out when the keys are read. Safe to repeat.
 */
export async function migrateKeyUses(storage: PluginStorage): Promise<void> {
	await storage.once("uses_as_references", async (migration) => {
		const uses = migration.collection<StoredUse & { label?: string }>(USES);
		for (const item of await uses.list()) {
			if (!("label" in item.value)) continue;
			await uses.set(item.key, { keyId: item.value.keyId }, { expectedVersion: item.version });
		}
	});
}
