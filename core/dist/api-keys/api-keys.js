import { randomUUID } from "node:crypto";
import { freeKeyName, } from "../core/api-keys.js";
import { CmsError } from "../core/store/index.js";
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
/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value) => (value.length >= 12 ? value.slice(-4) : "");
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
export function createApiKeys(options) {
    const { secrets } = options;
    const keys = () => options.storage().collection(KEYS);
    const uses = () => options.storage().collection(USES);
    const slotRows = () => options.storage().collection(SLOTS);
    const declared = () => options.declared?.() ?? [];
    const slotId = (plugin, slot) => `${plugin}:${slot}`;
    const usesByKey = async () => {
        const rows = (await uses().list()).map((item) => {
            const at = item.key.indexOf(":");
            return { item, plugin: item.key.slice(0, at), ref: item.key.slice(at + 1) };
        });
        const byPlugin = new Map();
        for (const { plugin, ref } of rows)
            byPlugin.set(plugin, [...(byPlugin.get(plugin) ?? []), ref]);
        const labels = new Map();
        for (const [plugin, refs] of byPlugin) {
            labels.set(plugin, (await options.labels?.(plugin, refs).catch(() => undefined)) ??
                Object.fromEntries(refs.map((ref) => [ref, plugin])));
        }
        const grouped = new Map();
        const of = (keyId) => {
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
            if (!place)
                continue;
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
                    .catch(() => { });
                continue;
            }
            of(item.value.keyId).uses.push({ plugin, ref, label: label ?? plugin });
        }
        return grouped;
    };
    const view = (item, found) => ({
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
    const list = async () => {
        const [items, places] = await Promise.all([keys().list(), usesByKey()]);
        return items
            .map((item) => view(item, places.get(item.key)))
            .sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
    };
    const assertNameFree = async (name, exceptId) => {
        const clash = (await keys().list()).find((item) => item.key !== exceptId && sameName(item.value.name, name));
        if (clash) {
            throw new CmsError(`There is already a key named "${name}"; pick another name`, "key_name_taken");
        }
    };
    const create = async (name, value) => {
        const secret = secrets.encrypt(value);
        const item = await keys().set(randomUUID(), { name, secret, tail: tailOf(value) }, { expectedVersion: 0 });
        return view(item, undefined);
    };
    const api = {
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
            if (choice.use === "none")
                return null;
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
            if (!current)
                throw new CmsError("Key not found", "not_found");
            if (name !== undefined && !sameName(name, current.value.name))
                await assertNameFree(name, id);
            const next = {
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
                if (item.value.keyId === id)
                    await uses().delete(item.key, { expectedVersion: item.version });
            }
            for (const item of await slotRows().list()) {
                if (item.value.keyId === id)
                    await slotRows().delete(item.key, { expectedVersion: item.version });
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
                    service: entry.service,
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
                if (current)
                    await slotRows().delete(id, { expectedVersion: current.version });
                return;
            }
            if (!(await keys().get(keyId)))
                throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input");
            await slotRows().set(id, { keyId }, { expectedVersion: current?.version ?? 0 });
        },
        assignSlot: async (plugin, slot, choice, { baseName }) => {
            const run = async (keysApi) => keysApi.setSlot(plugin, slot, await keysApi.choose(choice, { baseName }));
            await (options.atomic ? options.atomic(run) : run(api));
        },
        read: async (id) => {
            const item = await keys().get(id);
            return item ? secrets.decrypt(item.value.secret) : null;
        },
        setUses: async (plugin, places) => {
            const existing = new Set((await keys().list()).map((item) => item.key));
            const wanted = new Map(places.filter((place) => existing.has(place.keyId)).map((place) => [`${plugin}:${place.ref}`, place]));
            const current = await uses().list({ prefix: `${plugin}:` });
            for (const item of current) {
                if (!wanted.has(item.key))
                    await uses().delete(item.key, { expectedVersion: item.version });
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
export async function migrateKeyUses(storage) {
    await storage.once("uses_as_references", async (migration) => {
        const uses = migration.collection(USES);
        for (const item of await uses.list()) {
            if (!("label" in item.value))
                continue;
            await uses.set(item.key, { keyId: item.value.keyId }, { expectedVersion: item.version });
        }
    });
}
