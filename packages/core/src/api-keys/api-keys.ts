import { randomUUID } from "node:crypto";
import {
	type ApiKeyChoiceInput,
	type ApiKeyList,
	type ApiKeySlotView,
	type ApiKeyUse,
	type ApiKeyView,
	keyNameCandidate,
} from "../core/api-keys";
import { CmsError } from "../core/store";
import type { PluginStorage, StorageItem } from "../plugin/storage";
import type { PluginSecrets } from "../secrets";

/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (`cms.secrets("core-keys")`, derived from the server config's `secret`). A plugin that needs a key keeps the key's id, not its value, and reads the value
 * on the server when it calls the service.
 *
 * Where a key is used is one list of assignments, each an item of a plugin (`<plugin>:<ref>`) that points at a key:
 * - a **slot** is an assignment with a fixed ref (`slot:<id>`), declared once by the plugin (`keySlots`) and assigned in the admin;
 * - another use has a ref of the plugin's own choosing (`connection:<id>`) and is reported by the plugin whenever its items change (`setUses`); the text the
 *   admin shows for it comes from the plugin's `keyUses`.
 *
 * The value is never part of a view and never leaves the server. Reads change nothing.
 */

const KEYS = "keys";
const NAMES = "names";
const ASSIGNMENTS = "assignments";
const SLOT_REF = "slot:";

interface StoredKey {
	name: string;
	/** Encrypted value. */
	secret: string;
	tail: string;
}

/** An assignment points at a key. The place it is for is the item's key (`<plugin>:<ref>`). The text shown for it is worked out when the keys are read. */
interface StoredAssignment {
	keyId: string;
}

/** An entry of the name index: names are unique without regard to case, which the database enforces by making the lowercase name a key. */
interface StoredName {
	keyId: string;
}

/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value: string): string => (value.length >= 12 ? value.slice(-4) : "");

const nameKeyOf = (name: string) => name.toLowerCase();

/** One key slot of a plugin: where its server code reads the key, and what the admin sets. */
export interface ApiKeySlot {
	/** The value of the key assigned to the slot, for the server code that calls the service. `null` when none is assigned, the key was deleted, or it cannot be decrypted. Never send it to a browser. */
	read(): Promise<string | null>;
	/** Assigns a saved key, or clears the slot with `null`. */
	set(keyId: string | null): Promise<void>;
	/**
	 * Assigns what a form chose: a saved key, a typed value saved as a new key (named after the slot's service, `Service 2` ... when taken) in the same
	 * transaction as the assignment, or none (clears it).
	 */
	assign(choice: ApiKeyChoiceInput): Promise<void>;
}

export interface ApiKeys {
	/** Whether keys can be saved (the server config has a `secret`). */
	readonly available: boolean;
	/** What the admin API answers: every key with the places that use it, whether keys can be saved, and the slots the installed plugins declare. */
	view(): Promise<ApiKeyList>;
	/** Every key with the places that use it, by name. */
	list(): Promise<ApiKeyView[]>;
	get(id: string): Promise<ApiKeyView | null>;
	/** The keys the installed plugins ask for (`CmsPlugin.keySlots`), each with the key assigned to it or `null`. */
	slots(): Promise<ApiKeySlotView[]>;
	/** A slot of an installed plugin. It throws `not_found` when the plugin has no such slot. */
	slot(plugin: string, slot: string): ApiKeySlot;
	/** Saves a key under a name. A name another key has (in any case) fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`. */
	add(input: { name: string; value: string }): Promise<ApiKeyView>;
	/** Saves a key under `baseName`, or `baseName 2`, `baseName 3`, ... when that name is taken. */
	addNamed(input: { baseName: string; value: string }): Promise<ApiKeyView>;
	/** The saved key that has this value, or a new one named like {@link addNamed}. */
	findOrAdd(input: { baseName: string; value: string }): Promise<ApiKeyView>;
	/**
	 * Turns what a form sent for a place's key into the id to keep: the id of a saved key (which must exist), the id of a key just saved from the typed value
	 * (named `baseName`, or `baseName 2`, ... when taken), or `null` for no key.
	 */
	choose(choice: ApiKeyChoiceInput, options: { baseName: string }): Promise<string | null>;
	/** Renames and/or replaces the value. `expectedVersion` is the version read last; a different one fails with `conflict`. */
	update(id: string, input: { expectedVersion: number; name?: string; value?: string }): Promise<ApiKeyView>;
	/**
	 * Deletes a key and forgets where it was used, in one transaction. A key that something uses is kept and the call fails with `key_in_use` (`details.uses` lists the
	 * places that would stop working) unless `force` is set: then the plugins that used it keep its id and find no key behind it.
	 */
	remove(id: string, input: { expectedVersion: number; force?: boolean }): Promise<void>;
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
	 * use is not shown. A plugin that gives none is shown by its name.
	 */
	readonly labels?: (plugin: string, refs: readonly string[]) => Promise<Readonly<Record<string, string | null>>>;
	/** The slots the installed plugins declare (`CmsPlugin.keySlots`), with their labels in the admin language. */
	readonly declared?: () => readonly {
		readonly plugin: string;
		readonly slot: string;
		readonly label: string;
		readonly service: string;
	}[];
	/** Called after a slot was assigned or cleared and the change is saved (the slot's `onChange`). */
	readonly onSlotChange?: (plugin: string, slot: string) => Promise<void> | void;
	/**
	 * Runs work in one transaction with the key store (`cms.transaction`): it hands the work a storage that reads and writes through the transaction. Every
	 * write that touches more than one row runs through it. Without it the writes are made one after the other.
	 */
	readonly transact?: <T>(work: (storage: () => PluginStorage) => Promise<T>) => Promise<T>;
}

interface Uses {
	uses: ApiKeyUse[];
	slots: ApiKeyUse[];
}

const slotRowKey = (plugin: string, slot: string) => `${plugin}:${SLOT_REF}${slot}`;

/** The store on one storage (the pool's, or a transaction's). Writes are not wrapped in a transaction here: {@link createApiKeys} does that. */
function keysOn(options: ApiKeysOptions, storage: () => PluginStorage): ApiKeys {
	const { secrets } = options;
	const keys = () => storage().collection<StoredKey>(KEYS);
	const names = () => storage().collection<StoredName>(NAMES);
	const assignments = () => storage().collection<StoredAssignment>(ASSIGNMENTS);
	const declared = () => options.declared?.() ?? [];

	const usesByKey = async (): Promise<Map<string, Uses>> => {
		const rows = (await assignments().list()).map((item) => {
			const at = item.key.indexOf(":");
			return { keyId: item.value.keyId, plugin: item.key.slice(0, at), ref: item.key.slice(at + 1) };
		});
		const grouped = new Map<string, Uses>();
		const of = (keyId: string): Uses => {
			let found = grouped.get(keyId);
			if (!found) {
				found = { uses: [], slots: [] };
				grouped.set(keyId, found);
			}
			return found;
		};
		const items = new Map<string, string[]>();
		for (const row of rows) {
			if (row.ref.startsWith(SLOT_REF)) {
				// A slot is a use of an installed plugin: the declaration is what makes it a slot.
				const id = row.ref.slice(SLOT_REF.length);
				const place = declared().find((entry) => entry.plugin === row.plugin && entry.slot === id);
				if (!place) continue;
				const use = { plugin: place.plugin, ref: place.slot, label: place.label };
				of(row.keyId).uses.push(use);
				of(row.keyId).slots.push(use);
			} else {
				items.set(row.plugin, [...(items.get(row.plugin) ?? []), row.ref]);
			}
		}
		const labels = new Map<string, Readonly<Record<string, string | null>>>();
		for (const [plugin, refs] of items) {
			labels.set(
				plugin,
				(await options.labels?.(plugin, refs).catch(() => undefined)) ??
					Object.fromEntries(refs.map((ref) => [ref, plugin])),
			);
		}
		for (const row of rows) {
			if (row.ref.startsWith(SLOT_REF)) continue;
			const label = labels.get(row.plugin)?.[row.ref];
			// The item is gone: it is not shown (its plugin drops it the next time it tells the store its items).
			if (label === null) continue;
			of(row.keyId).uses.push({ plugin: row.plugin, ref: row.ref, label: label ?? row.plugin });
		}
		return grouped;
	};

	const view = (item: StorageItem<StoredKey>, found: Uses | undefined): ApiKeyView => ({
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

	/** Takes a name for a key: the name index has one row per lowercase name, so two writers of the same name cannot both succeed. */
	const claimName = async (name: string, keyId: string) => {
		try {
			await names().set(nameKeyOf(name), { keyId }, { expectedVersion: 0 });
		} catch (error) {
			if ((error as { code?: unknown }).code === "conflict") {
				throw new CmsError(`There is already a key named "${name}"; pick another name`, "key_name_taken");
			}
			throw error;
		}
	};

	const releaseName = async (name: string, keyId: string) => {
		const row = await names().get(nameKeyOf(name));
		if (row && row.value.keyId === keyId) await names().delete(row.key, { expectedVersion: row.version });
	};

	const create = async (name: string, value: string): Promise<ApiKeyView> => {
		const secret = secrets.encrypt(value);
		const id = randomUUID();
		await claimName(name, id);
		const item = await keys().set(id, { name, secret, tail: tailOf(value) }, { expectedVersion: 0 });
		return view(item, undefined);
	};

	const addNamed: ApiKeys["addNamed"] = async ({ baseName, value }) => {
		for (let attempt = 1; ; attempt++) {
			try {
				return await create(keyNameCandidate(baseName, attempt), value);
			} catch (error) {
				if ((error as { code?: unknown }).code !== "key_name_taken") throw error;
			}
		}
	};

	const read: ApiKeys["read"] = async (id) => {
		const item = await keys().get(id);
		return item ? secrets.decrypt(item.value.secret) : null;
	};

	const assertKeyExists = async (id: string) => {
		if (!(await keys().get(id))) {
			throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input");
		}
	};

	const choose: ApiKeys["choose"] = async (choice, { baseName }) => {
		if (choice.use === "none") return null;
		if (choice.use === "saved") {
			await assertKeyExists(choice.keyId);
			return choice.keyId;
		}
		return (await addNamed({ baseName, value: choice.value })).id;
	};

	const declaredSlot = (plugin: string, slot: string) => {
		const found = declared().find((entry) => entry.plugin === plugin && entry.slot === slot);
		if (!found) throw new CmsError(`The plugin "${plugin}" has no key slot "${slot}" (is it installed?)`, "not_found");
		return found;
	};

	const slotOf = (plugin: string, slot: string): ApiKeySlot => {
		const rowKey = slotRowKey(plugin, slot);
		const set: ApiKeySlot["set"] = async (keyId) => {
			declaredSlot(plugin, slot);
			const current = await assignments().get(rowKey);
			if (keyId === null) {
				if (current) await assignments().delete(rowKey, { expectedVersion: current.version });
				return;
			}
			await assertKeyExists(keyId);
			await assignments().set(rowKey, { keyId }, { expectedVersion: current?.version ?? 0 });
		};
		return {
			read: async () => {
				const row = await assignments().get(rowKey);
				return row ? read(row.value.keyId) : null;
			},
			set,
			assign: async (choice) => set(await choose(choice, { baseName: declaredSlot(plugin, slot).service })),
		};
	};

	const slots: ApiKeys["slots"] = async () => {
		const [all, places] = await Promise.all([list(), assignments().list()]);
		const byId = new Map(all.map((key) => [key.id, key]));
		const assigned = new Map(places.map((row) => [row.key, row.value.keyId]));
		return declared().map((entry) => {
			const key = byId.get(assigned.get(slotRowKey(entry.plugin, entry.slot)) ?? "");
			return {
				plugin: entry.plugin,
				slot: entry.slot,
				label: entry.label,
				service: entry.service,
				key: key ? { id: key.id, name: key.name, tail: key.tail, readable: key.readable } : null,
			};
		});
	};

	return {
		available: secrets.available,
		view: async () => ({ items: await list(), secretsAvailable: secrets.available, slots: await slots() }),
		list,
		get: async (id) => {
			const item = await keys().get(id);
			return item ? view(item, (await usesByKey()).get(id)) : null;
		},
		slots,
		slot: slotOf,
		add: ({ name, value }) => create(name, value),
		addNamed,
		findOrAdd: async ({ baseName, value }) => {
			for (const item of await keys().list()) {
				if (secrets.decrypt(item.value.secret) === value) return view(item, (await usesByKey()).get(item.key));
			}
			return addNamed({ baseName, value });
		},
		choose,
		update: async (id, { expectedVersion, name, value }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			const renamed = name !== undefined && nameKeyOf(name) !== nameKeyOf(current.value.name);
			if (renamed) await claimName(name, id);
			const next: StoredKey = {
				name: name ?? current.value.name,
				secret: value === undefined ? current.value.secret : secrets.encrypt(value),
				tail: value === undefined ? current.value.tail : tailOf(value),
			};
			let saved: StorageItem<StoredKey>;
			try {
				saved = await keys().set(id, next, { expectedVersion });
			} catch (error) {
				if (renamed) await releaseName(name, id);
				throw error;
			}
			if (renamed) await releaseName(current.value.name, id);
			return view(saved, (await usesByKey()).get(id));
		},
		remove: async (id, { expectedVersion, force = false }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			const found = (await usesByKey()).get(id)?.uses ?? [];
			if (found.length > 0 && !force) {
				throw new CmsError(
					`${found.length} place${found.length === 1 ? "" : "s"} use this key and would stop working`,
					"key_in_use",
					{ serverVersion: current.version, details: { uses: found } },
				);
			}
			await keys().delete(id, { expectedVersion });
			await releaseName(current.value.name, id);
			for (const item of await assignments().list()) {
				if (item.value.keyId === id) await assignments().delete(item.key, { expectedVersion: item.version });
			}
		},
		read,
		setUses: async (plugin, places) => {
			const existing = new Set((await keys().list()).map((item) => item.key));
			const wanted = new Map(
				places.filter((place) => existing.has(place.keyId)).map((place) => [`${plugin}:${place.ref}`, place]),
			);
			// A plugin's slots are not its to replace: only the items it reported.
			const current = (await assignments().list({ prefix: `${plugin}:` })).filter(
				(item) => !item.key.startsWith(`${plugin}:${SLOT_REF}`),
			);
			for (const item of current) {
				if (!wanted.has(item.key)) await assignments().delete(item.key, { expectedVersion: item.version });
			}
			const versions = new Map(current.map((item) => [item.key, item.version]));
			for (const [key, place] of wanted) {
				await assignments().set(key, { keyId: place.keyId }, { expectedVersion: versions.get(key) ?? 0 });
			}
		},
	};
}

export function createApiKeys(options: ApiKeysOptions): ApiKeys {
	const direct = keysOn(options, options.storage);
	const { transact, onSlotChange } = options;
	const inTx = <T>(work: (keys: ApiKeys) => Promise<T>): Promise<T> =>
		transact ? transact((storage) => work(keysOn(options, storage))) : work(direct);
	/** A slot whose change is saved first, then reported to the plugin that owns it. */
	const slotOf = (plugin: string, slot: string): ApiKeySlot => {
		const reported = async (change: () => Promise<void>) => {
			await change();
			await onSlotChange?.(plugin, slot);
		};
		return {
			read: () => direct.slot(plugin, slot).read(),
			set: (keyId) => reported(() => inTx((keys) => keys.slot(plugin, slot).set(keyId))),
			assign: (choice) => reported(() => inTx((keys) => keys.slot(plugin, slot).assign(choice))),
		};
	};
	if (!transact) return { ...direct, slot: slotOf };
	return {
		...direct,
		add: (input) => inTx((keys) => keys.add(input)),
		addNamed: (input) => inTx((keys) => keys.addNamed(input)),
		findOrAdd: (input) => inTx((keys) => keys.findOrAdd(input)),
		choose: (choice, where) => inTx((keys) => keys.choose(choice, where)),
		update: (id, input) => inTx((keys) => keys.update(id, input)),
		remove: (id, input) => inTx((keys) => keys.remove(id, input)),
		setUses: (plugin, uses) => inTx((keys) => keys.setUses(plugin, uses)),
		slot: slotOf,
	};
}
