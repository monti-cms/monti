import { base64url, fromBase64url, randomBytes } from "../bytes";

/**
 * Service keys at rest (doc 14, principle 3): sealed with `MONTI_SECRET`, so the database alone opens none of them. AES-256-GCM with a key derived
 * from the secret; Web Crypto, which the server and the browser (Storybook on PGlite) both have.
 *
 * A sealed key is bound to the row it is in: its id, its service and its address go in as the cipher's additional data. Someone who can write to
 * the database but does not know the secret cannot point a key at another address or service, or move it to another row: the row no longer opens,
 * so the server never sends the key where it was not sealed for.
 */

/** What a sealed key is bound to: where the server would send it. */
export type KeyBinding = { id: string; service: string; baseUrl: string | null };

const VERSION = "v1";
const subtle = () => globalThis.crypto.subtle;
const encode = (text: string) => new TextEncoder().encode(text);

const bound = (to: KeyBinding) => encode(JSON.stringify([to.id, to.service, to.baseUrl]));

/** An empty secret is no secret: a key sealed with it would be open to anyone who has the database. */
const usable = (secret: string) => secret.trim() !== "";

async function sealingKey(secret: string) {
	const material = await subtle().importKey("raw", encode(secret), "HKDF", false, ["deriveKey"]);
	return subtle().deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt: encode("monti:keys"), info: encode(VERSION) },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/** `v1.<iv>.<ciphertext>`, each part base64url. A fresh iv every time, so the same key sealed twice reads differently. */
export async function seal(secret: string, plain: string, to: KeyBinding): Promise<string> {
	if (!usable(secret)) throw new Error("Refusing to seal a key with an empty secret.");
	const iv = randomBytes(12);
	const sealed = await subtle().encrypt(
		{ name: "AES-GCM", iv, additionalData: bound(to) },
		await sealingKey(secret),
		encode(plain),
	);
	return `${VERSION}.${base64url(iv)}.${base64url(new Uint8Array(sealed))}`;
}

/**
 * The key as it was sealed, or `null` when it does not open: the server's secret changed, the value is not a sealed key, or it is not in the row it
 * was sealed for (`to` differs).
 */
export async function unseal(secret: string, sealed: string, to: KeyBinding): Promise<string | null> {
	const [version, iv, body] = sealed.split(".");
	if (!usable(secret) || version !== VERSION || !iv || body === undefined) return null;
	try {
		const plain = await subtle().decrypt(
			{ name: "AES-GCM", iv: fromBase64url(iv), additionalData: bound(to) },
			await sealingKey(secret),
			fromBase64url(body),
		);
		return new TextDecoder().decode(plain);
	} catch {
		return null;
	}
}
