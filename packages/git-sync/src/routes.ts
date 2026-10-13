import { type AdminRequest, adminRoute, CmsError, ok, publicRoute, readJsonBody } from "@monti-cms/core/plugin/server";
import { listConflicts, type Resolution, resolveConflict } from "./conflicts";
import { GitHubApiError } from "./github/client";
import { pullTarget } from "./inbound";
import { GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT } from "./options";
import { flushTarget, resumeAfterToken } from "./outbound";
import { saveSettings, settingsView } from "./settings";
import { statusView } from "./status";
import { GitSyncError, syncContextFor } from "./sync";
import { handleWebhook } from "./webhook";

/**
 * The plugin's API (the routes under `v1/git-sync/`, served below the CMS API path). Everything is admin only except the webhook, which GitHub calls and which checks its own signature.
 * Errors a person can fix (no token, a branch that does not exist) are 409 with their message; GitHub failing is 502.
 */

/** Turns what the sync code throws into the response the admin screen shows. */
const asHttpError = (error: unknown): unknown => {
	if (error instanceof GitHubApiError) return new CmsError(error.message, "upstream_failed");
	if (error instanceof GitSyncError) return new CmsError(error.message, "precondition_failed");
	return error;
};

type Input = AdminRequest<Record<string, string>>;

/** Runs a route and turns the errors the sync code throws into the response the admin screen shows. */
const guarded =
	(run: (input: Input) => Promise<Response>) =>
	async (input: Input): Promise<Response> => {
		try {
			return await run(input);
		} catch (error) {
			throw asHttpError(error);
		}
	};

const text = (body: unknown, key: string): string | undefined => {
	const value = (body as Record<string, unknown> | null)?.[key];
	if (value === undefined) return undefined;
	if (typeof value !== "string") throw new CmsError(`\`${key}\` must be text`, "invalid_input");
	return value;
};

export const status = {
	GET: adminRoute(async ({ cms }) => ok(await statusView(syncContextFor(cms)))),
};

export const settings = {
	GET: adminRoute(async ({ cms }) => ok(await settingsView(syncContextFor(cms)))),
	PUT: adminRoute(async ({ request, cms }) => {
		const body = (await readJsonBody(request)) as Record<string, unknown>;
		const expectedVersion = body.expectedVersion;
		if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
			throw new CmsError("expectedVersion is required", "version_required");
		}
		const webhookSecret = body.webhookSecret === null ? null : text(body, "webhookSecret");
		return ok(await saveSettings(syncContextFor(cms), { webhookSecret, expectedVersion }));
	}),
};

/** The admin screen calls this after it assigned a key to the token slot: what waited for a token goes out now. */
export const tokenChanged = {
	POST: adminRoute(async ({ cms }) => {
		if (await cms.apiKeys.slot(GIT_SYNC_PLUGIN_NAME, GIT_SYNC_TOKEN_SLOT).read())
			await resumeAfterToken(syncContextFor(cms));
		return ok({ ok: true });
	}),
};

export const pull = {
	POST: adminRoute(
		guarded(async ({ request, cms }) => {
			const ctx = syncContextFor(cms);
			const wanted = text(await readJsonBody(request), "target");
			const targets = wanted === undefined ? ctx.targets : [ctx.target(wanted)];
			const results = [];
			for (const target of targets) results.push({ target: target.id, summary: await pullTarget(ctx, target) });
			return ok({ results });
		}),
	),
};

export const flush = {
	POST: adminRoute(
		guarded(async ({ request, cms }) => {
			const ctx = syncContextFor(cms);
			const wanted = text(await readJsonBody(request), "target");
			const targets = wanted === undefined ? ctx.targets : [ctx.target(wanted)];
			const results = [];
			for (const target of targets) results.push(await flushTarget(ctx, target));
			return ok({ results });
		}),
	),
};

export const conflicts = {
	GET: adminRoute(guarded(async ({ cms }) => ok({ items: await listConflicts(syncContextFor(cms)) }))),
};

export const resolve = {
	POST: adminRoute(
		guarded(async ({ request, cms }) => {
			const body = await readJsonBody(request);
			const target = text(body, "target");
			const entryId = text(body, "entryId");
			const resolution = text(body, "resolution");
			if (!target || !entryId || (resolution !== "git" && resolution !== "server")) {
				throw new CmsError("`target`, `entryId` and `resolution` (git or server) are required", "invalid_input");
			}
			return ok(
				await resolveConflict(syncContextFor(cms), {
					target,
					entryId,
					resolution: resolution as Resolution,
					gitSha: text(body, "gitSha"),
				}),
			);
		}),
	),
};

/** GitHub's `push` webhook. Public: the signature is the check, and nothing else about the request is trusted. */
export const webhook = {
	POST: publicRoute(async ({ request, cms }) => {
		const rawBody = await request.text();
		const outcome = await handleWebhook(syncContextFor(cms), {
			rawBody,
			signature: request.headers.get("x-hub-signature-256"),
			event: request.headers.get("x-github-event"),
		});
		return ok(outcome.body, { status: outcome.status });
	}),
};
