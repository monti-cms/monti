import { createHmac, timingSafeEqual } from "node:crypto";
import { onDraftPullRequestClosed, pullDraft } from "./draft-inbound";
import { pullTarget } from "./inbound";
import { DRAFT_BRANCH_PREFIX, type ResolvedTarget } from "./options";
import { readWebhookSecret } from "./settings";
import type { PullSummary } from "./state";
import type { SyncContext } from "./sync";

/**
 * The GitHub webhook (`POST /api/cms/v1/git-sync/webhook`, content type `application/json`). GitHub signs the raw body with the webhook secret
 * (`X-Hub-Signature-256: sha256=<hmac>`); the secret is the one saved on the plugin's admin screen. The events it handles:
 *
 * - `push` to the branch of a target: the target is pulled.
 * - `push` to a draft branch (`monti/draft/...`) of a target with `drafts: true`: the file on the branch is saved as the entry's draft.
 * - `pull_request`, action `closed`, for a draft pull request (a target with `drafts: true`): merged publishes the entry, closed without merging changes nothing.
 */

/** Whether `signature` is the HMAC-SHA256 of the raw body under the secret (constant time). */
export function verifySignature(secret: string, rawBody: string, signature: string | null): boolean {
	if (!signature?.startsWith("sha256=")) return false;
	const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
	const given = Buffer.from(signature.slice("sha256=".length), "hex");
	return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface WebhookOutcome {
	readonly status: number;
	readonly body: Record<string, unknown>;
}

interface PushPayload {
	readonly ref?: unknown;
	readonly repository?: { readonly full_name?: unknown };
}

interface PullRequestPayload {
	readonly action?: unknown;
	readonly number?: unknown;
	readonly pull_request?: {
		readonly number?: unknown;
		readonly merged?: unknown;
		readonly head?: { readonly ref?: unknown };
		readonly base?: { readonly ref?: unknown };
	};
	readonly repository?: { readonly full_name?: unknown };
}

const sameRepo = (target: ResolvedTarget, repo: string) => target.repo.toLowerCase() === repo.toLowerCase();

/** The branch a draft `ref` names, or `undefined` when the ref is not a draft branch. */
const draftBranchOf = (ref: string): string | undefined => {
	const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : undefined;
	return branch?.startsWith(DRAFT_BRANCH_PREFIX) ? branch : undefined;
};

const targetsOf = (ctx: SyncContext, repo: string, ref: string): ResolvedTarget[] =>
	ctx.targets.filter(
		(target) => target.repo.toLowerCase() === repo.toLowerCase() && `refs/heads/${target.branch}` === ref,
	);

/** Handles one webhook delivery: checks the signature, then pulls the targets the push is for. */
export async function handleWebhook(
	ctx: SyncContext,
	delivery: { readonly rawBody: string; readonly signature: string | null; readonly event: string | null },
): Promise<WebhookOutcome> {
	const secret = await readWebhookSecret(ctx);
	if (!secret) {
		return {
			status: 503,
			body: { code: "webhook_not_configured", message: "No webhook secret is saved on the Git sync screen" },
		};
	}
	if (!verifySignature(secret, delivery.rawBody, delivery.signature)) {
		return { status: 401, body: { code: "invalid_signature", message: "The webhook signature does not match" } };
	}
	if (delivery.event === "ping") return { status: 200, body: { ok: true, pong: true } };
	if (delivery.event !== "push" && delivery.event !== "pull_request") {
		return { status: 202, body: { ok: true, ignored: `event "${delivery.event}"` } };
	}

	let payload: PushPayload & PullRequestPayload;
	try {
		payload = JSON.parse(delivery.rawBody) as PushPayload & PullRequestPayload;
	} catch {
		return { status: 400, body: { code: "invalid_input", message: "The payload is not JSON" } };
	}
	const repo = typeof payload.repository?.full_name === "string" ? payload.repository.full_name : "";
	if (delivery.event === "pull_request") return handlePullRequest(ctx, repo, payload);

	const ref = typeof payload.ref === "string" ? payload.ref : "";
	const draftBranch = draftBranchOf(ref);
	if (draftBranch !== undefined) {
		const draftTargets = ctx.targets.filter((target) => target.drafts && sameRepo(target, repo));
		if (draftTargets.length === 0)
			return { status: 202, body: { ok: true, ignored: `no target with drafts for ${repo} ${ref}` } };
		const drafts = [];
		for (const target of draftTargets) drafts.push(await pullDraft(ctx, target, draftBranch));
		return { status: 200, body: { ok: true, drafts } };
	}
	const targets = targetsOf(ctx, repo, ref);
	if (targets.length === 0) return { status: 202, body: { ok: true, ignored: `no target for ${repo} ${ref}` } };

	const pulled: { target: string; summary: PullSummary }[] = [];
	for (const target of targets) pulled.push({ target: target.id, summary: await pullTarget(ctx, target) });
	return { status: 200, body: { ok: true, pulled } };
}

/** A `pull_request` event: only `closed`, and only for a pull request from a draft branch into a target's branch, is a business of git-sync. */
async function handlePullRequest(ctx: SyncContext, repo: string, payload: PullRequestPayload): Promise<WebhookOutcome> {
	if (payload.action !== "closed")
		return { status: 202, body: { ok: true, ignored: `pull_request action "${String(payload.action)}"` } };
	const pullRequest = payload.pull_request;
	const head = typeof pullRequest?.head?.ref === "string" ? pullRequest.head.ref : "";
	const base = typeof pullRequest?.base?.ref === "string" ? pullRequest.base.ref : "";
	const number =
		typeof pullRequest?.number === "number"
			? pullRequest.number
			: typeof payload.number === "number"
				? payload.number
				: 0;
	if (!head.startsWith(DRAFT_BRANCH_PREFIX) || number === 0) {
		return { status: 202, body: { ok: true, ignored: "not a draft pull request" } };
	}
	const targets = ctx.targets.filter((target) => target.drafts && sameRepo(target, repo) && target.branch === base);
	if (targets.length === 0)
		return { status: 202, body: { ok: true, ignored: `no target with drafts for ${repo} ${base}` } };
	const closed = [];
	for (const target of targets) {
		closed.push(
			await onDraftPullRequestClosed(ctx, target, { number, branch: head, merged: pullRequest?.merged === true }),
		);
	}
	return { status: 200, body: { ok: true, closed } };
}
