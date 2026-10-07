import {
	type AdminRequest,
	adminRoute,
	HttpError,
	handleApiError,
	json,
	readJsonBody,
} from "@monti-cms/core/plugin/server";
import { listConflicts, type Resolution, resolveConflict } from "./conflicts";
import { GitHubApiError } from "./github/client";
import { pullTarget } from "./inbound";
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
	if (error instanceof GitHubApiError) return new HttpError(502, "github_error", error.message);
	if (error instanceof GitSyncError) return new HttpError(409, "git_sync", error.message);
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
	if (typeof value !== "string") throw new HttpError(400, "invalid_input", `\`${key}\` must be text`);
	return value;
};

export const status = {
	GET: adminRoute(async ({ cms }) => json(await statusView(syncContextFor(cms)))),
};

export const settings = {
	GET: adminRoute(async ({ cms }) => json(await settingsView(syncContextFor(cms)))),
	PUT: adminRoute(async ({ request, cms }) => {
		const body = (await readJsonBody(request)) as Record<string, unknown>;
		const expectedVersion = body.expectedVersion;
		if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
			throw new HttpError(428, "version_required", "expectedVersion is required");
		}
		const pick = (key: "token" | "webhookSecret"): string | null | undefined =>
			body[key] === null ? null : text(body, key);
		const ctx = syncContextFor(cms);
		const token = pick("token");
		const saved = await saveSettings(ctx, { token, webhookSecret: pick("webhookSecret"), expectedVersion });
		// A token was just saved: what waited for it goes out now.
		if (typeof token === "string" && token.trim() !== "") await resumeAfterToken(ctx);
		return json(saved);
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
			return json({ results });
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
			return json({ results });
		}),
	),
};

export const conflicts = {
	GET: adminRoute(guarded(async ({ cms }) => json({ items: await listConflicts(syncContextFor(cms)) }))),
};

export const resolve = {
	POST: adminRoute(
		guarded(async ({ request, cms }) => {
			const body = await readJsonBody(request);
			const target = text(body, "target");
			const entryId = text(body, "entryId");
			const resolution = text(body, "resolution");
			if (!target || !entryId || (resolution !== "git" && resolution !== "server")) {
				throw new HttpError(400, "invalid_input", "`target`, `entryId` and `resolution` (git or server) are required");
			}
			return json(
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
	POST: async (request: Request, context: { cms: Parameters<typeof syncContextFor>[0] }): Promise<Response> => {
		try {
			const rawBody = await request.text();
			const outcome = await handleWebhook(syncContextFor(context.cms), {
				rawBody,
				signature: request.headers.get("x-hub-signature-256"),
				event: request.headers.get("x-github-event"),
			});
			return json(outcome.body, { status: outcome.status });
		} catch (error) {
			return handleApiError(asHttpError(error));
		}
	},
};
