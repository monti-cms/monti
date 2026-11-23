import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { MontiError } from "../../engine/errors";

const ALGORITHM = "aes-256-gcm";

/** 엔진에 넘긴 암호화 비밀값(`secret`)에서 만든 암호화 키. 비밀값이 없거나 비어 있으면 거절한다. */
function keyOf(masterSecret: string | undefined): Buffer {
	if (!masterSecret) throw new MontiError("BAD_REQUEST", "엔진에 암호화 비밀값(secret)이 없습니다");
	return createHash("sha256").update(masterSecret).digest();
}

/** `value`를 `masterSecret`의 키와 새 IV로 암호화해 base64 `iv:tag:ciphertext`로 돌려준다. */
export function encryptSecret(masterSecret: string | undefined, value: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, keyOf(masterSecret), iv);
	const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
	return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(":");
}

/**
 * `encryptSecret`이 저장한 `iv:tag:ciphertext`를 `masterSecret`의 키로 복호화한다. 저장할 때와 다른 비밀값이라 풀 수 없으면
 * 거절하고, 저장된 값이 이 모양이 아니어도 같은 오류로 거절한다. 오류에는 저장된 값도 비밀값도 담지 않는다.
 */
export function decryptSecret(masterSecret: string | undefined, stored: string): string {
	const key = keyOf(masterSecret);
	try {
		const [iv, tag, encrypted] = stored.split(":").map((part) => Buffer.from(part, "base64"));
		const decipher = createDecipheriv(ALGORITHM, key, iv as Buffer, { authTagLength: 16 });
		decipher.setAuthTag(tag as Buffer);
		return Buffer.concat([decipher.update(encrypted as Buffer), decipher.final()]).toString();
	} catch {
		throw new MontiError("BAD_REQUEST", "저장된 키를 지금의 암호화 비밀값(secret)으로 풀 수 없습니다");
	}
}
