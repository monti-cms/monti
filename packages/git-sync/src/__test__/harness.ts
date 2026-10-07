import { defineConfig } from "@monti-cms/core";
import { type Cms, type CmsAuth, createCms, defineServerConfig, postgres } from "@monti-cms/core/server";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { vi } from "vitest";
import { baseConfig } from "../../test/cms.config";
import { gitSync } from "../index";
import type { GitSyncTarget } from "../options";
import { saveSettings } from "../settings";
import { type SyncContext, syncContextFor } from "../sync";
import { createFakeGitHub } from "../testing";

export const WEBHOOK_SECRET = "hook-secret";
export const TOKEN = "ghp_test_token_1234";

const adminAuth = (): CmsAuth => ({
	basePath: "/api/cms/auth",
	handlers: { GET: async () => new Response("auth"), POST: async () => new Response("auth") },
	session: async () => ({ user: { id: "admin", accountId: "admin" } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: (userId) => userId === "admin",
	devBypass: false,
	devUserId: "admin",
});

export interface HarnessOptions {
	/** Default: one target for `acme/site` (folder `content`) that syncs posts, memos and tags and commits. */
	readonly targets?: readonly GitSyncTarget[];
	/** Default 0: every publish is committed at once. */
	readonly debounceMs?: number;
	/** Leave the token and the webhook secret unsaved. */
	readonly noSettings?: boolean;
	/** The server config has no `secret`: nothing can be encrypted. Implies `noSettings`. */
	readonly noSecret?: boolean;
	/** Tries an event delivery gets before it is dead-lettered (the server config's `events.maxAttempts`). */
	readonly maxAttempts?: number;
}

export const DEFAULT_TARGET: GitSyncTarget = {
	id: "site",
	repo: "acme/site",
	branch: "main",
	folder: "content",
	collections: ["post", "memo", "tag"],
};

/**
 * A real CMS instance (Postgres in an isolated schema, the production store and content service, the `mdx` format, the plugin) against a GitHub in memory.
 * What the tests drive is what the app runs: a publish goes through the content service, the event outbox and the plugin's `afterCommit`.
 */
export async function createHarness(options: HarnessOptions = {}) {
	const github = createFakeGitHub();
	const repo = github.repo("acme/site", { main: { "README.md": "# site\n" } });
	const config = defineConfig({
		...baseConfig,
		plugins: [
			mdx(),
			gitSync({
				targets: options.targets ?? [DEFAULT_TARGET],
				debounceMs: options.debounceMs ?? 0,
				client: github.factory,
			}),
		],
	});
	const { pool, schemaName } = await createIsolatedTestPool();
	const cms: Cms = createCms({
		config,
		server: defineServerConfig({
			database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
			auth: { name: "test", create: adminAuth },
			...(options.noSecret ? {} : { secret: "a-long-test-secret-for-git-sync-tests" }),
			// Retries are driven by the tests: a failed delivery is due again after a minute (or at once with `retry({ all: true })`).
			events: { backoffMs: () => 60_000, ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}) },
		}),
	});
	await cms.migrate({ log: () => undefined });
	const ctx: SyncContext = syncContextFor(cms);
	if (!options.noSettings && !options.noSecret) {
		await saveSettings(ctx, { token: TOKEN, webhookSecret: WEBHOOK_SECRET, expectedVersion: 0 });
	}
	const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

	return {
		cms,
		ctx,
		github,
		repo,
		errors,
		/** The first target. */
		target:
			ctx.targets[0] ??
			(() => {
				throw new Error("no target");
			})(),
		service: cms.contentService(),
		store: cms.store(),
		async close() {
			errors.mockRestore();
			await cms.close();
			await dropIsolatedTestPool(pool, schemaName);
		},
	};
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export { closeGlobalPool };
