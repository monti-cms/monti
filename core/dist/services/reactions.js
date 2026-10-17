/** The kinds of committed change, one durable event each (`entry.created`, `entry.saved`, ...). */
export const ENTRY_CHANGE_KINDS = [
    "created",
    "saved",
    "published",
    "archived",
    "unarchived",
    "trashed",
    "restored",
    "deleted",
];
/**
 * The `before…` subscribers of one owner, one source per subscriber in the order they run (all its `beforeValidate`s, then its `beforeSave`s, then its
 * `beforePublish`es; the pipeline picks a stage at a time). Each gets its scope when it runs, so a development schema reload is seen.
 */
export function beforeSources(owner, events, scope) {
    const entry = events.entry;
    if (!entry)
        return [];
    return [
        ...(entry.beforeValidate ?? []).map((hook) => ({
            owner,
            hooks: { beforeValidate: (context) => hook(context, scope()) },
        })),
        ...(entry.beforeSave ?? []).map((hook) => ({
            owner,
            hooks: { beforeSave: (context) => hook(context, scope()) },
        })),
        ...(entry.beforePublish ?? []).map((hook) => ({
            owner,
            hooks: { beforePublish: (context) => hook(context, scope()) },
        })),
    ];
}
const SUBSCRIBER_NAME = /^[a-z][a-z0-9-]*$/;
/** The outbox key of a durable subscriber: its owner and its name. */
export const subscriberKey = (owner, name) => `${owner}:${name}`;
/**
 * The durable subscribers of one owner, keyed `<owner>:<name>`, each with its scope given when it runs. A subscriber listed under a kind is delivered only
 * the changes of that kind (the outbox makes no delivery rows for the others); under `changed` it gets every kind. Throws when a name is not valid or
 * is used twice by the owner.
 */
export function entrySubscribers(owner, events, scope) {
    const entry = events.entry;
    if (!entry)
        return [];
    const seen = new Set();
    const out = [];
    const lists = [
        ...ENTRY_CHANGE_KINDS.map((kind) => [kind, [kind]]),
        ["changed", ENTRY_CHANGE_KINDS],
    ];
    for (const [event, kinds] of lists) {
        for (const { name, run } of entry[event] ?? []) {
            if (!SUBSCRIBER_NAME.test(name)) {
                throw new Error(`on.entry.${event} of ${owner}: "${name}" is not a valid subscriber name. Use lowercase letters, digits and "-", starting with a letter.`);
            }
            if (seen.has(name)) {
                throw new Error(`on.entry of ${owner}: the subscriber name "${name}" is used twice. Give each subscriber its own name (a subscriber is delivered only the kind it is listed under).`);
            }
            seen.add(name);
            out.push({ name: subscriberKey(owner, name), kinds, handler: (change) => run(change, scope()) });
        }
    }
    return out;
}
