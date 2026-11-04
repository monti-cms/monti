import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a preview link works. */
export const PREVIEW_MINUTES = 60;

const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

/** A short-lived ticket that lets the site read one entry's working copy (doc 02, preview). */
export function previewToken(secret: string, entryId: string, expiresAt: Date): string {
	const body = `${entryId}.${expiresAt.getTime()}`;
	return Buffer.from(`${body}.${sign(secret, body)}`).toString("base64url");
}

/** The entry id a ticket opens, or `null` when it is forged or has expired. */
export function readPreviewToken(secret: string, token: string, now: Date): string | null {
	const [entryId, expires, signature] = Buffer.from(token, "base64url").toString().split(".");
	if (!entryId || !expires || !signature) return null;
	const expected = Buffer.from(sign(secret, `${entryId}.${expires}`));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	return Number(expires) > now.getTime() ? entryId : null;
}
