/** Random ids and byte encodings with Web Crypto, which the server and the browser (Storybook on PGlite) both have; the core never needs `node:crypto`. */

export const randomUUID = () => globalThis.crypto.randomUUID();

export const randomBytes = (size: number) => globalThis.crypto.getRandomValues(new Uint8Array(size));

export const hex = (bytes: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (text: string) =>
	new Uint8Array(text.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);

export const base64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export const fromBase64url = (text: string) =>
	Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

/** Equal strings, compared in a time that does not depend on where they differ. */
export function sameSecret(a: string, b: string): boolean {
	let diff = a.length ^ b.length;
	for (let index = 0; index < Math.max(a.length, b.length); index += 1)
		diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
	return diff === 0;
}

/** A 64-bit FNV-1a hash as 16 hex digits: a fingerprint to notice a change, not a secret. */
export function fingerprint(text: string): string {
	let hash = 0xcbf29ce484222325n;
	for (const byte of new TextEncoder().encode(text)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
	return hash.toString(16).padStart(16, "0");
}
