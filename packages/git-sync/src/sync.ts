import { randomUUID } from "node:crypto";
import type { CmsFormat } from "@monti-cms/core/format";
import type { Cms } from "@monti-cms/core/plugin/server";
import type { GitHubClient, GitHubClientFactory } from "./github/client";
import { githubClientFactory } from "./github/rest";
import {
	DEFAULT_DEBOUNCE_MS,
	GIT_SYNC_PLUGIN_NAME,
	type GitSyncOptions,
	type ResolvedTarget,
	resolveTargets,
} from "./options";
import { createPathPattern, type PathPattern } from "./path-pattern";
import { createState, type SyncState } from "./state";

/** An error a person can fix (a token that is not saved, a format that is not installed). It is thrown like any other, so the event outbox retries and then keeps it. */
export class GitSyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitSyncError";
	}
}

/**
 * No usable GitHub token is saved. That is a setup state, not a failure: the events of synced entries are deferred (not failed) until a token is saved, and the entries
 * wait in the queue.
 */
export class GitSyncNotConfigured extends GitSyncError {
	constructor(message: string) {
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

/** What a test can replace. */
export interface SyncDeps {
	readonly now?: () => number;
	readonly sleep?: (ms: number) => Promise<void>;
}

/** Everything the sync code needs for one CMS instance. */
export interface SyncContext {
	readonly cms: Cms;
	readonly options: GitSyncOptions;
	readonly targets: readonly ResolvedTarget[];
	readonly state: SyncState;
	readonly debounceMs: number;
	/** Targets this process is writing files into right now (an import in progress). A publish it causes is queued but not committed until the import ends. */
	readonly importing: Set<string>;
	now(): number;
	sleep(ms: number): Promise<void>;
	/** The target with this id. Throws when there is none. */
	target(id: string): ResolvedTarget;
	/** The GitHub client of a target, made with the saved token. Throws when no token is saved. */
	client(target: ResolvedTarget): Promise<GitHubClient>;
	/** The format of a target and its path pattern. Throws when the format is not installed or cannot import. */
	format(target: ResolvedTarget): Promise<{ readonly format: CmsFormat; readonly pattern: PathPattern }>;
	/** Runs `fn` while holding the target's lock: one flush or pull at a time per target, across processes. */
	withLock<T>(target: ResolvedTarget, fn: () => Promise<T>, options?: { readonly waitMs?: number }): Promise<T>;
}

/** The options of the plugin as the site config gives them. */
export function readOptions(cms: Cms): GitSyncOptions {
	const options = cms.site.getPluginOptions<GitSyncOptions>(GIT_SYNC_PLUGIN_NAME);
	if (!options) throw new GitSyncError("The git-sync plugin is not in the site config");
	return options;
}

export function createSyncContext(cms: Cms, deps: SyncDeps = {}): SyncContext {
	const options = readOptions(cms);
	const targets = resolveTargets(options);
	const state = createState(cms.storage(GIT_SYNC_PLUGIN_NAME));
	const now = deps.now ?? Date.now;
	const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const factory: GitHubClientFactory = options.client ?? githubClientFactory;
	const secrets = cms.secrets(GIT_SYNC_PLUGIN_NAME);
	const patterns = new Map<string, { format: CmsFormat; pattern: PathPattern }>();

	const context: SyncContext = {
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
			if (!found) throw new GitSyncError(`There is no git-sync target "${id}"`);
			return found;
		},
		client: async (target) => {
			const stored = (await state.settings.get())?.value.token;
			const token = stored ? secrets.decrypt(stored) : null;
			if (!token) {
				throw new GitSyncNotConfigured(
					stored
						? "The saved GitHub token cannot be read (the CMS secret changed); save the token again on the Git sync screen"
						: "No GitHub token is saved; add one on the Git sync screen",
				);
			}
			return factory({ token, repo: target.repo, ...(target.apiUrl ? { apiUrl: target.apiUrl } : {}) });
		},
		format: async (target) => {
			const cached = patterns.get(target.id);
			if (cached) return cached;
			const format = (await cms.formats()).get(target.format);
			if (!format) {
				throw new GitSyncError(
					`Target "${target.id}" writes files in the format "${target.format}", which this site does not have (is its plugin in the site config?)`,
				);
			}
			if (!format.import) {
				throw new GitSyncError(
					`Format "${target.format}" cannot import, so target "${target.id}" cannot sync both ways`,
				);
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
					throw new GitSyncError(`Target "${target.id}" is busy (another sync is running); it will be retried`);
				await sleep(LOCK_POLL_MS);
			}
			try {
				return await fn();
			} finally {
				await state.locks.release(target.id, holder).catch(() => undefined);
			}
		},
	};
	return context;
}

const contexts = new WeakMap<Cms, SyncContext>();

/** The sync context of an instance, made on first use. Each instance has its own. */
export function syncContextFor(cms: Cms): SyncContext {
	let context = contexts.get(cms);
	if (!context) {
		context = createSyncContext(cms);
		contexts.set(cms, context);
	}
	return context;
}
