import { randomUUID } from "node:crypto";
import type { ApiKeyList, ApiKeyServiceView, ApiKeySlotView, ApiKeyUse, ApiKeyView } from "../core/api-keys";
import { CmsError } from "../core/store";
import type { PluginKeyService } from "../plugin/define";
import type { PluginStorage, StorageItem } from "../plugin/storage";
import type { PluginSecrets } from "../secrets";

/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (the reserved scope `core-keys`, derived from the server config's `secret`).
 *
 * A key is a whole connection: it names the service it is for (declared by a plugin's `keyServices`) and, for a service at an address of the site's
 * choosing, that address. A key is checked with its service before it is saved. Whoever needs a service uses a key of it:
 * - a plugin's **slot** (`keySlots`) reads the key chosen for it, or else the first key of its service;
 * - another use (the AI plugin's quick-task model) is reported by the plugin whenever it changes (`setUses`); the text the admin shows for it comes
 *   from the plugin's `keyUses`.
 *
 * The value is never part of a view and never leaves the server. Reads change nothing. The tokens the services count are added up per key and month.
 */

const KEYS = "keys";
const NAMES = "names";
const ASSIGNMENTS = "assignments";
const USAGE = "usage";
const SLOT_REF = "slot:";

interface StoredKey {
	name: string;
	/** Where the key comes in the list: one more than the last key's when it was added (two keys can be added in the same millisecond). */
	order: number;
	service: string;
	url: string;
	/** Encrypted value, or `null` for a service that needs no key. */
	secret: string | null;
	tail: string;
}

/** An assignment points at a key. The place it is for is the item's key (`<plugin>:<ref>`). */
interface StoredAssignment {
	keyId: string;
}

/** An entry of the name index: names are unique without regard to case, which the database enforces by making the lowercase name a key. */
interface StoredName {
	keyId: string;
}

/** Tokens of one key in one month (`<key id>/<YYYY-MM>`). */
interface StoredUsage {
	tokens: number;
}

/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value: string): string => (value.length >= 12 ? value.slice(-4) : "");

const nameKeyOf = (name: string) => name.toLowerCase();

/** The month usage is counted in, in UTC: `2026-11`. */
export const usageMonth = (now: Date): string => now.toISOString().slice(0, 7);

const usageKey = (keyId: string, month: string) => `${keyId}/${month}`;

/** One key slot of a plugin: where its server code reads the key, and what the admin sets. */
export interface ApiKeySlot {
	/**
	 * The value of the key the slot reads (the one chosen for it, or else the first key of its service), for the server code that calls the service.
	 * `null` when the service has no key or it cannot be decrypted. Never send it to a browser.
	 */
	read(): Promise<string | null>;
	/** Chooses which key of the service the slot reads, or goes back to the first one with `null`. */
	set(keyId: string | null): Promise<void>;
}

/** A key's details for the server code that calls its service. Never send `value` to a browser. */
export interface ApiKeyAccess {
	readonly id: string;
	readonly service: string;
	readonly url: string;
	/** `null` when the key has no value (a service that needs none) or it cannot be decrypted. */
	readonly value: string | null;
	readonly readable: boolean;
}

export interface ApiKeys {
	/** Whether keys can be saved (the server config has a `secret`). */
	readonly available: boolean;
	/** What the admin API answers: every key with the places that use it, the services keys can be added for, whether keys can be saved, and the slots. */
	view(): Promise<ApiKeyList>;
	/** Every key with the places that use it, in the order they were added. */
	list(): Promise<ApiKeyView[]>;
	get(id: string): Promise<ApiKeyView | null>;
	/** The services keys can be added for (`ServerPlugin.keyServices` of the installed plugins). */
	services(): Promise<ApiKeyServiceView[]>;
	/** The keys the installed plugins ask for (`Plugin.keySlots`), each with the key it reads or `null`. */
	slots(): Promise<ApiKeySlotView[]>;
	/** A slot of an installed plugin. It throws `not_found` when the plugin has no such slot. */
	slot(plugin: string, slot: string): ApiKeySlot;
	/**
	 * Checks a key with its service and saves it. A service nobody declares, a missing address or value, or a key the service refuses (`key_rejected`)
	 * fails; a name another key has (in any case) fails with `key_name_taken`; no `secret` in the server config fails with `secret_not_configured`.
	 */
	add(input: { service: string; url?: string; name: string; value?: string }): Promise<ApiKeyView>;
	/** Renames and/or replaces the value (checked with the service first). `expectedVersion` is the version read last; a different one fails with `conflict`. */
	update(id: string, input: { expectedVersion: number; name?: string; value?: string }): Promise<ApiKeyView>;
	/**
	 * Deletes a key, forgets where it was used and what it counted, in one transaction. A key that something uses is kept and the call fails with
	 * `key_in_use` (`details.uses` lists the places that would stop working) unless `force` is set.
	 */
	remove(id: string, input: { expectedVersion: number; force?: boolean }): Promise<void>;
	/** A key's service, address and value, for the server code that calls the service. `null` if there is no such key. Never send the value to a browser. */
	access(id: string): Promise<ApiKeyAccess | null>;
	/** Adds what a service counted for one call to the key's tokens this month. A key that is gone is skipped. */
	recordUsage(id: string, tokens: number): Promise<void>;
	/**
	 * Tells the store every item a plugin uses a key for (`ref`: a stable reference such as `quick`), replacing what it told before. An item that names a key
	 * that does not exist is left out. Only references are stored: the text the admin shows comes from the plugin's `keyUses` when the keys are read.
	 */
	setUses(plugin: string, uses: readonly { ref: string; keyId: string }[]): Promise<void>;
}

/** A service as the store uses it: what the admin lists, with the plugin that declares it and its check. */
export interface DeclaredKeyService extends PluginKeyService {
	readonly plugin: string;
}

export interface ApiKeysOptions {
	readonly storage: () => PluginStorage;
	readonly secrets: PluginSecrets;
	/**
	 * The text for each item of a plugin that uses keys, in the admin language (the plugin's `keyUses`). `null` for an item that does not exist any more: its
	 * use is not shown. A plugin that gives none is shown by its name.
	 */
	readonly labels?: (
		plugin: string,
		refs: readonly string[],
	) => Promise<Readonly<Record<string, string | { label: string; value?: string } | null>>>;
	/** The services the installed plugins declare (`ServerPlugin.keyServices`), with their labels in the admin language. */
	readonly services?: () => Promise<readonly DeclaredKeyService[]>;
	/** The slots the installed plugins declare (`Plugin.keySlots`), with their labels in the admin language. */
	readonly declared?: () => readonly {
		readonly plugin: string;
		readonly slot: string;
		readonly label: string;
		readonly service: string;
	}[];
	/** Called after a slot's choice was changed and saved (the slot's `onChange`). */
	readonly onSlotChange?: (plugin: string, slot: string) => Promise<void> | void;
	/**
	 * Runs work in one transaction with the key store (`cms.transaction`): it hands the work a storage that reads and writes through the transaction. Every
	 * write that touches more than one row runs through it. Without it the writes are made one after the other.
	 */
	readonly transact?: <T>(work: (storage: () => PluginStorage) => Promise<T>) => Promise<T>;
}

const slotRowKey = (plugin: string, slot: string) => `${plugin}:${SLOT_REF}${slot}`;

/** What a key will be saved as, once its service accepted it. */
interface Checked {
	service: string;
	url: string;
	value: string | null;
}

/** The writes of the store on one storage (the pool's, or a transaction's). The service checks are made before, outside any transaction. */
interface KeyWrites {
	insert(input: { name: string } & Checked): Promise<ApiKeyView>;
	change(id: string, input: { expectedVersion: number; name?: string; value?: string }): Promise<ApiKeyView>;
	remove(id: string, input: { expectedVersion: number; force?: boolean }): Promise<void>;
	setUses(plugin: string, uses: readonly { ref: string; keyId: string }[]): Promise<void>;
	setSlot(plugin: string, slot: string, keyId: string | null): Promise<void>;
	recordUsage(id: string, tokens: number): Promise<void>;
}

function storeOn(options: ApiKeysOptions, storage: () => PluginStorage) {
	const { secrets } = options;
	const keys = () => storage().collection<StoredKey>(KEYS);
	const names = () => storage().collection<StoredName>(NAMES);
	const assignments = () => storage().collection<StoredAssignment>(ASSIGNMENTS);
	const usage = () => storage().collection<StoredUsage>(USAGE);
	const declared = () => options.declared?.() ?? [];
	const month = () => usageMonth(new Date());

	const decrypt = (item: StorageItem<StoredKey>): string | null =>
		item.value.secret === null ? null : secrets.decrypt(item.value.secret);
	const readableOf = (item: StorageItem<StoredKey>) => item.value.secret === null || decrypt(item) !== null;

	/** Keys in the order they were added, which is how the admin lists them and which key of a service a slot reads first. */
	const sortKeys = (items: StorageItem<StoredKey>[]) =>
		[...items].sort((a, b) => a.value.order - b.value.order || a.key.localeCompare(b.key));

	/** For each slot, the key it reads: the one chosen for it if it is still a key of the slot's service, or else the first key of the service. */
	const slotKeys = async (): Promise<Map<string, StorageItem<StoredKey>>> => {
		const [all, rows] = await Promise.all([keys().list(), assignments().list({ prefix: "" })]);
		const sorted = sortKeys(all);
		const chosen = new Map(rows.map((row) => [row.key, row.value.keyId]));
		const found = new Map<string, StorageItem<StoredKey>>();
		for (const entry of declared()) {
			const rowKey = slotRowKey(entry.plugin, entry.slot);
			const pick = sorted.find((item) => item.key === chosen.get(rowKey) && item.value.service === entry.service);
			const key = pick ?? sorted.find((item) => item.value.service === entry.service);
			if (key) found.set(rowKey, key);
		}
		return found;
	};

	const usesByKey = async (): Promise<Map<string, ApiKeyUse[]>> => {
		const grouped = new Map<string, ApiKeyUse[]>();
		const add = (keyId: string, use: ApiKeyUse) => grouped.set(keyId, [...(grouped.get(keyId) ?? []), use]);
		const bySlot = await slotKeys();
		for (const entry of declared()) {
			const key = bySlot.get(slotRowKey(entry.plugin, entry.slot));
			if (key) add(key.key, { plugin: entry.plugin, ref: `${SLOT_REF}${entry.slot}`, label: entry.label });
		}
		const rows = (await assignments().list())
			.map((item) => {
				const at = item.key.indexOf(":");
				return { keyId: item.value.keyId, plugin: item.key.slice(0, at), ref: item.key.slice(at + 1) };
			})
			.filter((row) => !row.ref.startsWith(SLOT_REF));
		const refsOf = new Map<string, string[]>();
		for (const row of rows) refsOf.set(row.plugin, [...(refsOf.get(row.plugin) ?? []), row.ref]);
		const labels = new Map<string, Readonly<Record<string, string | { label: string; value?: string } | null>>>();
		for (const [plugin, refs] of refsOf) {
			labels.set(
				plugin,
				(await options.labels?.(plugin, refs).catch(() => undefined)) ??
					Object.fromEntries(refs.map((ref) => [ref, plugin])),
			);
		}
		for (const row of rows) {
			const label = labels.get(row.plugin)?.[row.ref];
			// The item is gone: it is not shown (its plugin drops it the next time it tells the store its items).
			if (label === null) continue;
			const text = typeof label === "object" ? label : { label: label ?? row.plugin };
			add(row.keyId, {
				plugin: row.plugin,
				ref: row.ref,
				label: text.label,
				...(text.value ? { value: text.value } : {}),
			});
		}
		return grouped;
	};

	const usageOf = async (keyId: string): Promise<number> =>
		(await usage().get(usageKey(keyId, month())))?.value.tokens ?? 0;

	const view = (item: StorageItem<StoredKey>, uses: readonly ApiKeyUse[] | undefined, tokens: number): ApiKeyView => ({
		id: item.key,
		name: item.value.name,
		service: item.value.service,
		url: item.value.url,
		tail: item.value.tail,
		readable: readableOf(item),
		usage: tokens,
		version: item.version,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString(),
		uses: uses ?? [],
	});

	const list = async (): Promise<ApiKeyView[]> => {
		const [items, places, counted] = await Promise.all([keys().list(), usesByKey(), usage().list()]);
		const thisMonth = new Map(
			counted
				.filter((row) => row.key.endsWith(`/${month()}`))
				.map((row) => [row.key.slice(0, row.key.lastIndexOf("/")), row.value.tokens]),
		);
		return sortKeys(items).map((item) => view(item, places.get(item.key), thisMonth.get(item.key) ?? 0));
	};

	const get = async (id: string): Promise<ApiKeyView | null> => {
		const item = await keys().get(id);
		return item ? view(item, (await usesByKey()).get(id), await usageOf(id)) : null;
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

	const declaredSlot = (plugin: string, slot: string) => {
		const found = declared().find((entry) => entry.plugin === plugin && entry.slot === slot);
		if (!found) throw new CmsError(`The plugin "${plugin}" has no key slot "${slot}" (is it installed?)`, "not_found");
		return found;
	};

	const writes: KeyWrites = {
		insert: async ({ name, service, url, value }) => {
			const id = randomUUID();
			await claimName(name, id);
			const order = Math.max(0, ...(await keys().list()).map((item) => item.value.order)) + 1;
			const item = await keys().set(
				id,
				{
					name,
					order,
					service,
					url,
					secret: value === null ? null : secrets.encrypt(value),
					tail: value ? tailOf(value) : "",
				},
				{ expectedVersion: 0 },
			);
			return view(item, undefined, 0);
		},
		change: async (id, { expectedVersion, name, value }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			const renamed = name !== undefined && nameKeyOf(name) !== nameKeyOf(current.value.name);
			if (renamed) await claimName(name, id);
			const next: StoredKey = {
				...current.value,
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
			return view(saved, (await usesByKey()).get(id), await usageOf(id));
		},
		remove: async (id, { expectedVersion, force = false }) => {
			const current = await keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			const found = (await usesByKey()).get(id) ?? [];
			if (found.length > 0 && !force) {
				throw new CmsError(
					`${found.length} place${found.length === 1 ? "" : "s"} use this key and would stop working`,
					"key_in_use",
					{
						serverVersion: current.version,
						details: { uses: found },
						notice: { key: "key.in_use", vars: { count: found.length } },
					},
				);
			}
			await keys().delete(id, { expectedVersion });
			await releaseName(current.value.name, id);
			for (const item of await assignments().list()) {
				if (item.value.keyId === id) await assignments().delete(item.key, { expectedVersion: item.version });
			}
			for (const item of await usage().list({ prefix: `${id}/` })) {
				await usage().delete(item.key, { expectedVersion: item.version });
			}
		},
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
			const rows = new Map(current.map((item) => [item.key, item]));
			for (const [key, place] of wanted) {
				const row = rows.get(key);
				// Telling the same again writes nothing.
				if (row?.value.keyId === place.keyId) continue;
				await assignments().set(key, { keyId: place.keyId }, { expectedVersion: row?.version ?? 0 });
			}
		},
		setSlot: async (plugin, slot, keyId) => {
			const entry = declaredSlot(plugin, slot);
			const rowKey = slotRowKey(plugin, slot);
			const current = await assignments().get(rowKey);
			if (keyId === null) {
				if (current) await assignments().delete(rowKey, { expectedVersion: current.version });
				return;
			}
			const key = await keys().get(keyId);
			if (!key || key.value.service !== entry.service) {
				throw new CmsError("The chosen key does not exist or is for another service; pick another", "invalid_input", {
					notice: { key: "key.missing" },
				});
			}
			await assignments().set(rowKey, { keyId }, { expectedVersion: current?.version ?? 0 });
		},
		recordUsage: async (id, tokens) => {
			if (!(tokens > 0) || !(await keys().get(id))) return;
			const rowKey = usageKey(id, month());
			for (let attempt = 0; ; attempt++) {
				const current = await usage().get(rowKey);
				try {
					await usage().set(
						rowKey,
						{ tokens: (current?.value.tokens ?? 0) + Math.round(tokens) },
						{ expectedVersion: current?.version ?? 0 },
					);
					return;
				} catch (error) {
					if (attempt >= 2 || (error as { code?: unknown }).code !== "conflict") throw error;
				}
			}
		},
	};

	return {
		keys,
		list,
		get,
		writes,
		slotKeys,
		decrypt,
		readableOf,
		declaredSlot,
	};
}

export function createApiKeys(options: ApiKeysOptions): ApiKeys {
	const { transact, onSlotChange, secrets } = options;
	const direct = storeOn(options, options.storage);
	const inTx = <T>(work: (writes: KeyWrites) => Promise<T>): Promise<T> =>
		transact ? transact((storage) => work(storeOn(options, storage).writes)) : work(direct.writes);
	const declaredServices = async () => (await options.services?.()) ?? [];

	const services = async (): Promise<ApiKeyServiceView[]> =>
		(await declaredServices())
			.map(({ id, label, group, hint, url, keyPlaceholder, keyOptional }) => ({
				id,
				label,
				group,
				...(hint ? { hint } : {}),
				...(url ? { url: { placeholder: url.placeholder } } : {}),
				...(keyPlaceholder ? { keyPlaceholder } : {}),
				...(keyOptional ? { keyOptional } : {}),
			}))
			.sort((a, b) => (a.group === b.group ? 0 : a.group === "ai" ? -1 : 1));

	const slots = async (): Promise<ApiKeySlotView[]> => {
		const bySlot = await direct.slotKeys();
		return (options.declared?.() ?? []).map((entry) => {
			const key = bySlot.get(slotRowKey(entry.plugin, entry.slot));
			return {
				plugin: entry.plugin,
				slot: entry.slot,
				label: entry.label,
				service: entry.service,
				key: key ? { id: key.key, name: key.value.name, tail: key.value.tail, readable: direct.readableOf(key) } : null,
			};
		});
	};

	/** Asks the service whether it takes the key. The answer decides; a check that cannot reach the service says so instead of guessing. */
	const check = async (service: DeclaredKeyService, url: string, value: string | null) => {
		if (!service.check) return;
		const answer = await service.check({ url, value });
		if (answer === "rejected") {
			throw new CmsError("The service did not accept this key", "key_rejected", { notice: { key: "key.rejected" } });
		}
	};

	const serviceOf = async (id: string): Promise<DeclaredKeyService> => {
		const found = (await declaredServices()).find((service) => service.id === id);
		if (!found) throw new CmsError(`No installed plugin offers the service "${id}"`, "invalid_input");
		return found;
	};

	const assertSecrets = () => {
		// Fails with `secret_not_configured` before a service is asked anything.
		if (!secrets.available) secrets.encrypt("");
	};

	const add: ApiKeys["add"] = async ({ service: serviceId, url, name, value }) => {
		assertSecrets();
		const service = await serviceOf(serviceId);
		const address = service.url ? (url ?? "").trim().replace(/\/+$/, "") : "";
		if (service.url && !address) {
			throw new CmsError(`The service "${serviceId}" needs an address`, "invalid_input");
		}
		if (!value && !service.keyOptional) throw new CmsError(`The service "${serviceId}" needs a key`, "invalid_input");
		await check(service, address, value ?? null);
		return inTx((writes) => writes.insert({ name, service: service.id, url: address, value: value ?? null }));
	};

	const update: ApiKeys["update"] = async (id, input) => {
		if (input.value !== undefined) {
			const current = await direct.keys().get(id);
			if (!current) throw new CmsError("Key not found", "not_found");
			const service = (await declaredServices()).find((entry) => entry.id === current.value.service);
			if (service) await check(service, current.value.url, input.value);
		}
		return inTx((writes) => writes.change(id, input));
	};

	const slotOf = (plugin: string, slot: string): ApiKeySlot => ({
		read: async () => {
			direct.declaredSlot(plugin, slot);
			const key = (await direct.slotKeys()).get(slotRowKey(plugin, slot));
			return key ? direct.decrypt(key) : null;
		},
		set: async (keyId) => {
			await inTx((writes) => writes.setSlot(plugin, slot, keyId));
			await onSlotChange?.(plugin, slot);
		},
	});

	return {
		available: secrets.available,
		view: async () => ({
			items: await direct.list(),
			secretsAvailable: secrets.available,
			services: await services(),
			slots: await slots(),
		}),
		list: direct.list,
		get: direct.get,
		services,
		slots,
		slot: slotOf,
		add,
		update,
		remove: (id, input) => inTx((writes) => writes.remove(id, input)),
		access: async (id) => {
			const item = await direct.keys().get(id);
			if (!item) return null;
			return {
				id: item.key,
				service: item.value.service,
				url: item.value.url,
				value: direct.decrypt(item),
				readable: direct.readableOf(item),
			};
		},
		recordUsage: (id, tokens) => direct.writes.recordUsage(id, tokens),
		setUses: (plugin, uses) => inTx((writes) => writes.setUses(plugin, uses)),
	};
}
