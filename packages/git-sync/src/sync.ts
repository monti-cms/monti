import { randomUUID } from "node:crypto";
import type { CmsFormat } from "@monti-cms/core/format";
import { type Cms, problemText } from "@monti-cms/core/plugin/server";
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
	if (!options) {
		throw new GitSyncError(
			problemText({
				what: "The git-sync plugin is not in the site config",
				where: "`plugins` in monti.config.ts",
				fix: "add `gitSync({ targets: [...] })` (from @monti-cms/git-sync) to the list",
			}),
		);
	}
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
						? problemText({
								what: "The saved GitHub token cannot be read, because MONTI_SECRET changed since it was saved",
								where: `the Git sync screen (${cms.site.adminHref("/git-sync")})`,
								fix: "save the token again there, or put the old secret back (as MONTI_SECRET, or listed in `previousSecrets` in monti.config.ts)",
							})
						: problemText({
								what: "No GitHub token is saved, so nothing is pushed or pulled yet",
								where: `the Git sync screen (${cms.site.adminHref("/git-sync")})`,
								fix: "paste a GitHub token that can read and write the repo's contents there; `monti doctor` lists what else is missing",
							}),
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
					problemText({
						what: `Target "${target.id}" writes files in the format "${target.format}", which this site does not have`,
						where: "`plugins` in monti.config.ts, and `format` of the target",
						fix: 'add the plugin that provides the format (mdx() from @monti-cms/mdx provides "mdx"; install the package first), or give the target another format',
					}),
				);
			}
			if (!format.import) {
				throw new GitSyncError(
					problemText({
						what: `Format "${target.format}" cannot import, so target "${target.id}" cannot sync both ways`,
						where: "`format` of the target in gitSync() of monti.config.ts",
						fix: "use a format that can read files back (mdx does)",
					}),
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
