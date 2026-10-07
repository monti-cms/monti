import { type DoctorCheck, fail, ok, skip, warn } from "@monti-cms/core/plugin/server";
import { GitHubApiError } from "./github/client";
import { settingsView } from "./settings";
import { GitSyncNotConfigured, type SyncContext, syncContextFor } from "./sync";

/** The Git sync screen's address, for the `where` and `fix` of a message. */
const screenOf = (ctx: SyncContext): string => ctx.cms.site.adminHref("/git-sync");

/** The webhook address GitHub must call, from the site URL (or a placeholder). */
const webhookUrlOf = (ctx: SyncContext, env: Readonly<Record<string, string | undefined>>): string => {
	const site = (env.SITE_URL?.trim() || ctx.cms.site.config.site?.url || "https://your-domain.com").replace(/\/+$/, "");
	return `${site}/api/cms/v1/git-sync/webhook`;
};

/** The saved settings, or `undefined` when the database cannot be read (the database checks say why). */
async function savedSettings(ctx: SyncContext) {
	try {
		return await settingsView(ctx);
	} catch {
		return undefined;
	}
}

const targets: DoctorCheck = {
	id: "targets",
	title: "Targets",
	run: ({ cms }) => {
		const ctx = syncContextFor(cms);
		if (ctx.targets.length === 0) {
			return warn("no target is listed, so nothing syncs", {
				where: "`targets` of gitSync() in monti.config.ts",
				fix: 'name a repo: gitSync({ targets: [{ repo: "you/content", branch: "main", folder: "content", collections: ["post"], mode: "commit" }] })',
			});
		}
		return ok(
			ctx.targets
				.map((target) => `${target.id}: ${target.repo}@${target.branch}${target.folder ? `/${target.folder}` : ""}`)
				.join("\n"),
		);
	},
};

const format: DoctorCheck = {
	id: "format",
	title: "File format",
	run: async ({ cms }) => {
		const ctx = syncContextFor(cms);
		if (ctx.targets.length === 0) return skip("not checked: no target");
		const registry = await cms.formats();
		const problems: string[] = [];
		for (const target of ctx.targets) {
			const found = registry.get(target.format);
			if (!found) problems.push(`target "${target.id}" writes files as "${target.format}", which no plugin provides`);
			else if (!found.import)
				problems.push(
					`the "${target.format}" format of target "${target.id}" cannot be read back, so it cannot sync both ways`,
				);
		}
		return problems.length === 0
			? ok(`${[...new Set(ctx.targets.map((target) => target.format))].join(", ")} available`)
			: fail(problems.join("; "), {
					where: "`format` of the target, and `plugins` in monti.config.ts",
					fix: 'add the plugin that provides the format to `plugins` (mdx() from @monti-cms/mdx provides "mdx"; install the package first), or give the target a format that exists',
				});
	},
};

const token: DoctorCheck = {
	id: "token",
	title: "GitHub token",
	run: async ({ cms }) => {
		const ctx = syncContextFor(cms);
		const settings = await savedSettings(ctx);
		if (!settings) return skip("not checked: the saved settings cannot be read (see the database checks)");
		if (!settings.secretsAvailable) {
			return fail("MONTI_SECRET is not set, so a token cannot be saved or read", {
				where: ".env.local (and the environment settings of your host)",
				fix: "set MONTI_SECRET (`openssl rand -base64 32`), then save the token on the Git sync screen",
			});
		}
		if (settings.token.set && !settings.token.readable) {
			return fail("a token is saved but cannot be read: MONTI_SECRET changed since it was saved", {
				where: `${screenOf(ctx)} (saved settings)`,
				fix: `save the token again on the Git sync screen, or put the old secret back (as MONTI_SECRET, or listed in \`previousSecrets\`)`,
			});
		}
		if (!settings.token.set) {
			return warn("no GitHub token is saved, so published entries wait in the queue and nothing is pushed", {
				where: `the Git sync screen (${screenOf(ctx)})`,
				fix: `create a fine-grained token (GitHub, Settings, Developer settings, Personal access tokens) with Contents: read and write (and Pull requests: read and write for \`mode: "pr"\`) on the repo, and paste it on the Git sync screen`,
			});
		}
		return ok(`saved (${settings.token.hint ?? "hidden"})`, { where: screenOf(ctx) });
	},
};

const webhookSecret: DoctorCheck = {
	id: "webhook-secret",
	title: "Webhook secret",
	run: async ({ cms, env }) => {
		const ctx = syncContextFor(cms);
		if (ctx.targets.length === 0) return skip("not checked: no target");
		const settings = await savedSettings(ctx);
		if (!settings) return skip("not checked: the saved settings cannot be read (see the database checks)");
		if (settings.webhookSecret.set && !settings.webhookSecret.readable) {
			return fail("a webhook secret is saved but cannot be read: MONTI_SECRET changed since it was saved", {
				where: `${screenOf(ctx)} (saved settings)`,
				fix: "save the webhook secret again on the Git sync screen, and set the same value in the repo's webhook",
			});
		}
		if (!settings.webhookSecret.set) {
			return warn(
				'no webhook secret is saved, so pushes to the repo are not pulled into the CMS (only "Pull now" and `monti git-sync:pull` work)',
				{
					where: `the Git sync screen (${screenOf(ctx)})`,
					fix: `choose a secret and save it on the Git sync screen; then in the repo's Settings, Webhooks, add a webhook: Payload URL ${webhookUrlOf(ctx, env)}, content type application/json, the same secret, event "Just the push event"`,
				},
			);
		}
		return ok(`saved; the repo's webhook must call ${webhookUrlOf(ctx, env)}`, { where: screenOf(ctx) });
	},
};

const repo: DoctorCheck = {
	id: "repo",
	title: "Repo reachable with the token",
	online: true,
	run: async ({ cms }) => {
		const ctx = syncContextFor(cms);
		if (ctx.targets.length === 0) return skip("not checked: no target");
		const lines: string[] = [];
		const problems: string[] = [];
		const fixes: string[] = [];
		for (const target of ctx.targets) {
			try {
				const client = await ctx.client(target);
				await client.getRepo();
				const head = await client.getBranchHead(target.branch);
				if (!head) {
					problems.push(`target "${target.id}": the branch "${target.branch}" does not exist in ${target.repo}`);
					fixes.push(`create the branch "${target.branch}" in ${target.repo}, or change \`branch\` of the target`);
				} else lines.push(`${target.repo}@${target.branch} reachable`);
			} catch (error) {
				if (error instanceof GitSyncNotConfigured) return skip("not checked: no usable token is saved (see above)");
				if (error instanceof GitHubApiError && error.status === 401) {
					problems.push(`target "${target.id}": GitHub rejected the token (401)`);
					fixes.push("the token is wrong, expired or revoked: create a new one and save it on the Git sync screen");
				} else if (error instanceof GitHubApiError && (error.status === 404 || error.status === 403)) {
					problems.push(
						`target "${target.id}": ${target.repo} was not found, or the token cannot see it (${error.status})`,
					);
					fixes.push(
						`check the repo name "${target.repo}", and give the token access to that repo (a fine-grained token lists the repos it may use)`,
					);
				} else {
					problems.push(`target "${target.id}": ${error instanceof Error ? error.message : String(error)}`);
					fixes.push("check the network and GitHub's status, then run `monti doctor --online` again");
				}
			}
		}
		return problems.length === 0
			? ok(lines.join("\n"))
			: fail(problems.join("\n"), {
					where: "the token on the Git sync screen, and `targets` in monti.config.ts",
					fix: [...new Set(fixes)].join("\n"),
				});
	},
};

/** The checks git-sync adds to `monti doctor`. */
export const gitSyncChecks: readonly DoctorCheck[] = [targets, format, token, webhookSecret, repo];
