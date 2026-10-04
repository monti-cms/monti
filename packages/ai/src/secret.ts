import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createTranslator } from "@monti-cms/core/client";
import { getCmsSecret } from "@monti-cms/core/plugin/server";
import { AiError } from "./errors";
import { providerMessages } from "./provider.messages";

const t = createTranslator(providerMessages);

/**
 * AI 서비스 키 암호화. 서버 설정의 `secret`에서 만든 키로 AES-256-GCM 암호화해 DB에 둔다.
 * `secret`을 바꾸면 저장된 키를 풀 수 없으니 AI 화면에서 다시 넣어야 한다.
 */

const PREFIX = "v1";

function encryptionKey(): Buffer {
	const secret = getCmsSecret();
	if (!secret) throw new AiError("ai_unavailable", t("noSecret"));
	return createHash("sha256").update(`cms-ai-key:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return [PREFIX, iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

/** 풀 수 없으면(`secret`이 바뀌었거나 값이 깨졌으면) `null`. */
export function decryptSecret(stored: string): string | null {
	const [prefix, iv, tag, body] = stored.split(":");
	if (prefix !== PREFIX || !iv || !tag || !body) return null;
	try {
		const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
		decipher.setAuthTag(Buffer.from(tag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}

/** 화면에 보여 줄 키 끝 네 글자. */
export const keyHint = (plain: string | null): string | null => (plain ? `…${plain.slice(-4)}` : null);
