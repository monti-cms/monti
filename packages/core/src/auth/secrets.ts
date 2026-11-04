/** Password hashing and tokens with Web Crypto, which the server and the browser (Storybook on PGlite) both have. */
const subtle = () => globalThis.crypto.subtle;
const encode = (text: string) => new TextEncoder().encode(text);
const hex = (bytes: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const fromHex = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);

const ITERATIONS = 600_000;

async function derive(password: string, salt: Uint8Array, iterations: number) {
	const key = await subtle().importKey("raw", encode(password), "PBKDF2", false, ["deriveBits"]);
	return hex(await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** `pbkdf2$<iterations>$<salt>$<hash>`. */
export async function hashPassword(password: string, iterations = ITERATIONS): Promise<string> {
	const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
	return `pbkdf2$${iterations}$${hex(salt)}$${await derive(password, salt, iterations)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [kind, iterations, salt, hash] = stored.split("$");
	if (kind !== "pbkdf2" || !iterations || !salt || !hash) return false;
	const given = await derive(password, fromHex(salt), Number(iterations));
	// Same length always; compare every character so the time says nothing.
	let diff = given.length ^ hash.length;
	for (let index = 0; index < given.length; index += 1) diff |= given.charCodeAt(index) ^ hash.charCodeAt(index);
	return diff === 0;
}

export const randomToken = () => hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));

export const sha256 = async (text: string) => hex(await subtle().digest("SHA-256", encode(text)));
