import { randomUUID } from "node:crypto";
import { keyNameCandidate, } from "../core/api-keys.js";
import { CmsError } from "../core/store/index.js";
/**
 * The central API key store of one CMS instance (`cms.apiKeys`). Named keys are kept in the core's own storage, encrypted with the core's own key
 * (the reserved scope `core-keys`, derived from the server config's `secret`). A plugin that needs a key keeps the key's id, not its value, and reads the value
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
/** The last four characters of a value, if it is long enough that they say little about it. */
const tailOf = (value) => (value.length >= 12 ? value.slice(-4) : "");
const nameKeyOf = (name) => name.toLowerCase();
const slotRowKey = (plugin, slot) => `${plugin}:${SLOT_REF}${slot}`;
/** The store on one storage (the pool's, or a transaction's). Writes are not wrapped in a transaction here: {@link createApiKeys} does that. */
function keysOn(options, storage) {
    const { secrets } = options;
    const keys = () => storage().collection(KEYS);
    const names = () => storage().collection(NAMES);
    const assignments = () => storage().collection(ASSIGNMENTS);
    const declared = () => options.declared?.() ?? [];
    const usesByKey = async () => {
        const rows = (await assignments().list()).map((item) => {
            const at = item.key.indexOf(":");
            return { keyId: item.value.keyId, plugin: item.key.slice(0, at), ref: item.key.slice(at + 1) };
        });
        const grouped = new Map();
        const of = (keyId) => {
            let found = grouped.get(keyId);
            if (!found) {
                found = { uses: [], slots: [] };
                grouped.set(keyId, found);
            }
            return found;
        };
        const items = new Map();
        for (const row of rows) {
            if (row.ref.startsWith(SLOT_REF)) {
                // A slot is a use of an installed plugin: the declaration is what makes it a slot.
                const id = row.ref.slice(SLOT_REF.length);
                const place = declared().find((entry) => entry.plugin === row.plugin && entry.slot === id);
                if (!place)
                    continue;
                const use = { plugin: place.plugin, ref: place.slot, label: place.label };
                of(row.keyId).uses.push(use);
                of(row.keyId).slots.push(use);
            }
            else {
                items.set(row.plugin, [...(items.get(row.plugin) ?? []), row.ref]);
            }
        }
        const labels = new Map();
        for (const [plugin, refs] of items) {
            labels.set(plugin, (await options.labels?.(plugin, refs).catch(() => undefined)) ??
                Object.fromEntries(refs.map((ref) => [ref, plugin])));
        }
        for (const row of rows) {
            if (row.ref.startsWith(SLOT_REF))
                continue;
            const label = labels.get(row.plugin)?.[row.ref];
            // The item is gone: it is not shown (its plugin drops it the next time it tells the store its items).
            if (label === null)
                continue;
            of(row.keyId).uses.push({ plugin: row.plugin, ref: row.ref, label: label ?? row.plugin });
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
    /** Takes a name for a key: the name index has one row per lowercase name, so two writers of the same name cannot both succeed. */
    const claimName = async (name, keyId) => {
        try {
            await names().set(nameKeyOf(name), { keyId }, { expectedVersion: 0 });
        }
        catch (error) {
            if (error.code === "conflict") {
                throw new CmsError(`There is already a key named "${name}"; pick another name`, "key_name_taken");
            }
            throw error;
        }
    };
    const releaseName = async (name, keyId) => {
        const row = await names().get(nameKeyOf(name));
        if (row && row.value.keyId === keyId)
            await names().delete(row.key, { expectedVersion: row.version });
    };
    const create = async (name, value) => {
        const secret = secrets.encrypt(value);
        const id = randomUUID();
        await claimName(name, id);
        const item = await keys().set(id, { name, secret, tail: tailOf(value) }, { expectedVersion: 0 });
        return view(item, undefined);
    };
    const addNamed = async ({ baseName, value }) => {
        for (let attempt = 1;; attempt++) {
            try {
                return await create(keyNameCandidate(baseName, attempt), value);
            }
            catch (error) {
                if (error.code !== "key_name_taken")
                    throw error;
            }
        }
    };
    const read = async (id) => {
        const item = await keys().get(id);
        return item ? secrets.decrypt(item.value.secret) : null;
    };
    const assertKeyExists = async (id) => {
        if (!(await keys().get(id))) {
            throw new CmsError("The chosen key does not exist (it may have been deleted); pick another", "invalid_input", {
                notice: { key: "key.missing" },
            });
        }
    };
    const choose = async (choice, { baseName }) => {
        if (choice.use === "none")
            return null;
        if (choice.use === "saved") {
            await assertKeyExists(choice.keyId);
            return choice.keyId;
        }
        return (await addNamed({ baseName, value: choice.value })).id;
    };
    const declaredSlot = (plugin, slot) => {
        const found = declared().find((entry) => entry.plugin === plugin && entry.slot === slot);
        if (!found)
            throw new CmsError(`The plugin "${plugin}" has no key slot "${slot}" (is it installed?)`, "not_found");
        return found;
    };
    const slotOf = (plugin, slot) => {
        const rowKey = slotRowKey(plugin, slot);
        const set = async (keyId) => {
            declaredSlot(plugin, slot);
            const current = await assignments().get(rowKey);
            if (keyId === null) {
                if (current)
                    await assignments().delete(rowKey, { expectedVersion: current.version });
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
    const slots = async () => {
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
                if (secrets.decrypt(item.value.secret) === value)
                    return view(item, (await usesByKey()).get(item.key));
            }
            return addNamed({ baseName, value });
        },
        choose,
        update: async (id, { expectedVersion, name, value }) => {
            const current = await keys().get(id);
            if (!current)
                throw new CmsError("Key not found", "not_found");
            const renamed = name !== undefined && nameKeyOf(name) !== nameKeyOf(current.value.name);
            if (renamed)
                await claimName(name, id);
            const next = {
                name: name ?? current.value.name,
                secret: value === undefined ? current.value.secret : secrets.encrypt(value),
                tail: value === undefined ? current.value.tail : tailOf(value),
            };
            let saved;
            try {
                saved = await keys().set(id, next, { expectedVersion });
            }
            catch (error) {
                if (renamed)
                    await releaseName(name, id);
                throw error;
            }
            if (renamed)
                await releaseName(current.value.name, id);
            return view(saved, (await usesByKey()).get(id));
        },
        remove: async (id, { expectedVersion, force = false }) => {
            const current = await keys().get(id);
            if (!current)
                throw new CmsError("Key not found", "not_found");
            const found = (await usesByKey()).get(id)?.uses ?? [];
            if (found.length > 0 && !force) {
                throw new CmsError(`${found.length} place${found.length === 1 ? "" : "s"} use this key and would stop working`, "key_in_use", {
                    serverVersion: current.version,
                    details: { uses: found },
                    notice: { key: "key.in_use", vars: { count: found.length } },
                });
            }
            await keys().delete(id, { expectedVersion });
            await releaseName(current.value.name, id);
            for (const item of await assignments().list()) {
                if (item.value.keyId === id)
                    await assignments().delete(item.key, { expectedVersion: item.version });
            }
        },
        read,
        setUses: async (plugin, places) => {
            const existing = new Set((await keys().list()).map((item) => item.key));
            const wanted = new Map(places.filter((place) => existing.has(place.keyId)).map((place) => [`${plugin}:${place.ref}`, place]));
            // A plugin's slots are not its to replace: only the items it reported.
            const current = (await assignments().list({ prefix: `${plugin}:` })).filter((item) => !item.key.startsWith(`${plugin}:${SLOT_REF}`));
            for (const item of current) {
                if (!wanted.has(item.key))
                    await assignments().delete(item.key, { expectedVersion: item.version });
            }
            const versions = new Map(current.map((item) => [item.key, item.version]));
            for (const [key, place] of wanted) {
                await assignments().set(key, { keyId: place.keyId }, { expectedVersion: versions.get(key) ?? 0 });
            }
        },
    };
}
export function createApiKeys(options) {
    const direct = keysOn(options, options.storage);
    const { transact, onSlotChange } = options;
    const inTx = (work) => transact ? transact((storage) => work(keysOn(options, storage))) : work(direct);
    /** A slot whose change is saved first, then reported to the plugin that owns it. */
    const slotOf = (plugin, slot) => {
        const reported = async (change) => {
            await change();
            await onSlotChange?.(plugin, slot);
        };
        return {
            read: () => direct.slot(plugin, slot).read(),
            set: (keyId) => reported(() => inTx((keys) => keys.slot(plugin, slot).set(keyId))),
            assign: (choice) => reported(() => inTx((keys) => keys.slot(plugin, slot).assign(choice))),
        };
    };
    if (!transact)
        return { ...direct, slot: slotOf };
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
