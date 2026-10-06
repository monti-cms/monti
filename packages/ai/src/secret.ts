import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createTranslator } from "@monti-cms/core/client";
import { AiError } from "./errors";
import { providerMessages } from "./provider.messages";

const t = createTranslator(providerMessages);

/**
 * Encryption of AI service keys. Keys are encrypted with AES-256-GCM using a key derived from the server config's `secret` (`cms.secret`, passed in) and stored in the DB.
 * Changing `secret` makes stored keys undecryptable, so they must be entered again on the AI screen.
 */

const PREFIX = "v1";

function encryptionKey(secret: string | undefined): Buffer {
	if (!secret) throw new AiError("ai_unavailable", t("noSecret"));
	return createHash("sha256").update(`cms-ai-key:${secret}`).digest();
}

export function encryptSecret(plain: string, secret: string | undefined): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return [PREFIX, iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

/** `null` if it cannot be decrypted (`secret` changed or the value is corrupted). */
export function decryptSecret(stored: string, secret: string | undefined): string | null {
	const [prefix, iv, tag, body] = stored.split(":");
	if (prefix !== PREFIX || !iv || !tag || !body) return null;
	try {
		const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(iv, "base64"));
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}

/** The last four characters of the key, shown on screen. */
export const keyHint = (plain: string | null): string | null => (plain ? `…${plain.slice(-4)}` : null);
