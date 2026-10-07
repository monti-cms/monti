import { createHmac, timingSafeEqual } from "node:crypto";
import { pullTarget } from "./inbound";
import type { ResolvedTarget } from "./options";
import { readWebhookSecret } from "./settings";
import type { PullSummary } from "./state";
import type { SyncContext } from "./sync";

/**
 * The GitHub `push` webhook (`POST /api/cms/v1/git-sync/webhook`, content type `application/json`). GitHub signs the raw body with the webhook secret
 * (`X-Hub-Signature-256: sha256=<hmac>`); the secret is the one saved on the plugin's admin screen. A push to the branch of a target pulls that target.
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
	if (delivery.event !== "push") return { status: 202, body: { ok: true, ignored: `event "${delivery.event}"` } };

	let payload: PushPayload;
	try {
		payload = JSON.parse(delivery.rawBody) as PushPayload;
	} catch {
		return { status: 400, body: { code: "invalid_input", message: "The payload is not JSON" } };
	}
	const repo = typeof payload.repository?.full_name === "string" ? payload.repository.full_name : "";
	const ref = typeof payload.ref === "string" ? payload.ref : "";
	const targets = targetsOf(ctx, repo, ref);
	if (targets.length === 0) return { status: 202, body: { ok: true, ignored: `no target for ${repo} ${ref}` } };

	const pulled: { target: string; summary: PullSummary }[] = [];
	for (const target of targets) pulled.push({ target: target.id, summary: await pullTarget(ctx, target) });
	return { status: 200, body: { ok: true, pulled } };
}
