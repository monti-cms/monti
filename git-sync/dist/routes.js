import { adminRoute, CmsError, ok, parseWith, publicRoute, readJsonBody, } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { listConflicts, resolveConflict } from "./conflicts.js";
import { GitHubApiError } from "./github/client.js";
import { pullTarget } from "./inbound.js";
import { flushTarget } from "./outbound.js";
import { serverMessages } from "./server.messages.js";
import { statusView } from "./status.js";
import { GitSyncError, syncContextFor } from "./sync.js";
import { handleWebhook } from "./webhook.js";
/**
 * The plugin's API (the routes under `v1/git-sync/`, served below the CMS API path). Everything is admin only except the webhook, which GitHub calls and which checks its own signature.
 * Errors a person can fix (no token, a branch that does not exist) are 409 with their message; GitHub failing is 502.
 */
/** Turns what the sync code throws into the response the admin screen shows. */
const toCmsError = (error) => {
    if (error instanceof GitHubApiError)
        return new CmsError(error.message, "upstream_failed");
    if (error instanceof GitSyncError)
        return new CmsError(error.message, "precondition_failed");
    return error;
};
/** Runs a route and turns the errors the sync code throws into the response the admin screen shows. */
const guarded = (run) => async (input) => {
    try {
        return await run(input);
    }
    catch (error) {
        throw toCmsError(error);
    }
};
const targetBodySchema = z.object({ target: z.string().optional() });
const resolveBodySchema = z.object({
    target: z.string().min(1),
    entryId: z.string().min(1),
    resolution: z.enum(["git", "server"]),
    gitSha: z.string().optional(),
});
export const status = {
    GET: adminRoute(async ({ cms }) => ok(await statusView(syncContextFor(cms)))),
};
export const pull = {
    POST: adminRoute(guarded(async ({ request, cms }) => {
        const ctx = syncContextFor(cms);
        const { target: wanted } = parseWith(targetBodySchema, await readJsonBody(request));
        const targets = wanted === undefined ? ctx.targets : [ctx.target(wanted)];
        const results = [];
        for (const target of targets)
            results.push({ target: target.id, summary: await pullTarget(ctx, target) });
        return ok({ results });
    })),
};
export const flush = {
    POST: adminRoute(guarded(async ({ request, cms }) => {
        const ctx = syncContextFor(cms);
        const { target: wanted } = parseWith(targetBodySchema, await readJsonBody(request));
        const targets = wanted === undefined ? ctx.targets : [ctx.target(wanted)];
        const results = [];
        for (const target of targets)
            results.push(await flushTarget(ctx, target));
        return ok({ results });
    })),
};
export const conflicts = {
    GET: adminRoute(guarded(async ({ cms }) => ok({ items: await listConflicts(syncContextFor(cms)) }))),
};
export const resolve = {
    POST: adminRoute(guarded(async ({ request, cms }) => {
        const body = parseWith(resolveBodySchema, await readJsonBody(request), cms.site.createTranslator(serverMessages)("resolveBody"));
        return ok(await resolveConflict(syncContextFor(cms), { ...body, resolution: body.resolution }));
    })),
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
