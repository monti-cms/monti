import type { SyncContext } from "./sync.js";
/**
 * The GitHub webhook (`POST /api/cms/v1/git-sync/webhook`, content type `application/json`). GitHub signs the raw body with the webhook secret
 * (`X-Hub-Signature-256: sha256=<hmac>`); the secret is the one saved on the plugin's admin screen. The events it handles:
 *
 * - `push` to the branch of a target: the target is pulled.
 */
/** Whether `signature` is the HMAC-SHA256 of the raw body under the secret (constant time). */
export declare function verifySignature(secret: string, rawBody: string, signature: string | null): boolean;
export interface WebhookOutcome {
    readonly status: number;
    readonly body: Record<string, unknown>;
}
/** Handles one webhook delivery: checks the signature, then pulls the targets the push is for. */
export declare function handleWebhook(ctx: SyncContext, delivery: {
    readonly rawBody: string;
    readonly signature: string | null;
    readonly event: string | null;
}): Promise<WebhookOutcome>;
