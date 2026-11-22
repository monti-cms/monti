import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt) as (password: string, salt: string, length: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** 소금을 친 scrypt 해시. 16진수 `salt:key`로 저장한다. */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const key = await derive(password, salt, KEY_LENGTH);
	return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [salt, key] = stored.split(":");
	const derived = await derive(password, String(salt), KEY_LENGTH);
	return timingSafeEqual(derived, Buffer.from(String(key), "hex"));
}
