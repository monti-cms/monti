import { randomUUID } from "node:crypto";
import { githubClientFactory } from "./github/rest.js";
import { tokenKeyOf } from "./keys.js";
import { DEFAULT_DEBOUNCE_MS, GIT_SYNC_PLUGIN, GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT, resolveTargets, } from "./options.js";
import { createPathPattern } from "./path-pattern.js";
import { serverMessages } from "./server.messages.js";
import { createState } from "./state.js";
/** An error a person can fix (a token that is not saved, a format that is not installed). It is thrown like any other, so the event outbox retries and then keeps it. */
export class GitSyncError extends Error {
    constructor(message) {
        super(message);
        this.name = "GitSyncError";
    }
}
/**
 * No usable GitHub token is saved. That is a setup state, not a failure: the events of synced entries are deferred (not failed) until a token is saved, and the entries
 * wait in the queue.
 */
export class GitSyncNotConfigured extends GitSyncError {
    constructor(message) {
        super(message);
        this.name = "GitSyncNotConfigured";
    }
}
/** How long a delivery waits when no token is saved. Saving a token resumes the deliveries at once. */
export const NOT_CONFIGURED_RETRY_MS = 60 * 60 * 1000;
/** The lock of a target is kept for this long if its holder stops without releasing it. */
const LOCK_TTL_MS = 5 * 60 * 1000;
/** How long a lock is waited for before giving up (the caller is retried). */
const LOCK_WAIT_MS = 15 * 1000;
const LOCK_POLL_MS = 150;
/** An import marks the files it writes for this long, so the publishes it causes are not pushed back. */
export const APPLYING_WINDOW_MS = 60 * 1000;
/** The options of the plugin as the site config gives them. */
export function readOptions(cms) {
    const options = cms.site.pluginOptions(GIT_SYNC_PLUGIN);
    if (!options) {
        throw new GitSyncError(cms.site.createTranslator(serverMessages)("pluginMissing"));
    }
    return options;
}
export function createSyncContext(cms, deps = {}) {
    const options = readOptions(cms);
    const targets = resolveTargets(options);
    const state = createState(cms.plugin(GIT_SYNC_PLUGIN_NAME).storage);
    const now = deps.now ?? Date.now;
    const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const factory = options.client ?? githubClientFactory;
    const patterns = new Map();
    const context = {
        cms,
        options,
        targets,
        state,
        debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
        importing: new Set(),
        now,
        sleep,
        target: (id) => {
            const found = targets.find((target) => target.id === id);
            if (!found)
                throw new GitSyncError(cms.site.createTranslator(serverMessages)("noTarget", { id }));
            return found;
        },
        client: async (target) => {
            const token = await cms.plugin(GIT_SYNC_PLUGIN_NAME).key(GIT_SYNC_TOKEN_SLOT).read();
            if (!token) {
                // A key that is there but cannot be read is another problem than a key that was never chosen (or was deleted).
                const unreadable = (await tokenKeyOf(cms)) !== null;
                const t = cms.site.createTranslator(serverMessages);
                const where = cms.site.adminHref("/tools/git-sync");
                throw new GitSyncNotConfigured(t(unreadable ? "tokenUnreadable" : "tokenMissing", { where }));
            }
            return factory({ token, repo: target.repo, ...(target.apiUrl ? { apiUrl: target.apiUrl } : {}) });
        },
        format: async (target) => {
            const cached = patterns.get(target.id);
            if (cached)
                return cached;
            const format = (await cms.formats()).get(target.format);
            const t = cms.site.createTranslator(serverMessages);
            if (!format) {
                throw new GitSyncError(t("formatMissing", { target: target.id, format: target.format }));
            }
            if (!format.import) {
                throw new GitSyncError(t("formatCannotImport", { target: target.id, format: target.format }));
            }
            const found = {
                format,
                pattern: createPathPattern({ target, locales: cms.site.LOCALES, extension: format.extension }),
            };
            patterns.set(target.id, found);
            return found;
        },
        withLock: async (target, fn, lockOptions) => {
            const holder = randomUUID();
            const deadline = now() + (lockOptions?.waitMs ?? LOCK_WAIT_MS);
            while (!(await state.locks.tryAcquire(target.id, holder, LOCK_TTL_MS, now()))) {
                if (now() >= deadline)
                    throw new GitSyncError(cms.site.createTranslator(serverMessages)("targetBusy", { target: target.id }));
                await sleep(LOCK_POLL_MS);
            }
            try {
                return await fn();
            }
            finally {
                await state.locks.release(target.id, holder).catch(() => undefined);
            }
        },
    };
    return context;
}
/** The sync context of an instance, made on first use and again after a schema reload (`cms.plugin(...).once`). */
export function syncContextFor(cms) {
    return cms.plugin(GIT_SYNC_PLUGIN_NAME).once("sync-context", () => createSyncContext(cms));
}
