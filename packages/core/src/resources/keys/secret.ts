import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

/** The key that encrypts every stored secret, derived inside the core: nothing has to be configured. */
const KEY = createHash("sha256").update("monti api_keys secret").digest();

/** Encrypts `secret` with a new IV, stored as `iv:tag:ciphertext` in base64. */
export function encryptSecret(secret: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, KEY, iv);
	const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
	return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(":");
}

export function decryptSecret(stored: string): string {
	const [iv, tag, encrypted] = stored.split(":").map((part) => Buffer.from(part, "base64"));
	const decipher = createDecipheriv(ALGORITHM, KEY, iv as Buffer);
	decipher.setAuthTag(tag as Buffer);
	return Buffer.concat([decipher.update(encrypted as Buffer), decipher.final()]).toString();
}
