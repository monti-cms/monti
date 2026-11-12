import { base64url, fromBase64url, sameSecret } from "../bytes";

/** How long a preview link works. */
export const PREVIEW_MINUTES = 60;

async function sign(secret: string, body: string) {
	const encoder = new TextEncoder();
	const key = await globalThis.crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return base64url(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(body))));
}

/** Whether a secret is one: empty or only spaces signs nothing, since anyone can guess it. */
export const isSecret = (secret: string | null | undefined): secret is string => !!secret && secret.trim() !== "";

/** A short-lived ticket that lets the site read one entry's working copy (doc 02, preview). */
export async function previewToken(secret: string, entryId: string, expiresAt: Date): Promise<string> {
	if (!isSecret(secret)) throw new Error("A preview link needs a secret that is not empty.");
	const body = `${entryId}.${expiresAt.getTime()}`;
	return base64url(new TextEncoder().encode(`${body}.${await sign(secret, body)}`));
}

/** The entry id a ticket opens, or `null` when it is forged or has expired. */
export async function readPreviewToken(secret: string, token: string, now: Date): Promise<string | null> {
	// A ticket signed with an empty secret is one anybody could have made.
	if (!isSecret(secret)) return null;
	let text: string;
	try {
		text = new TextDecoder().decode(fromBase64url(token));
	} catch {
		return null;
	}
	const [entryId, expires, signature] = text.split(".");
	if (!entryId || !expires || !signature) return null;
	if (!sameSecret(await sign(secret, `${entryId}.${expires}`), signature)) return null;
	return Number(expires) > now.getTime() ? entryId : null;
}
