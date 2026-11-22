import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * `cwd`의 `.env`와 `.env.local`을 Node 내장 `parseEnv`로 읽어 `env`와 합친 환경 변수를 돌려준다. 같은 이름이면 `env` >
 * `.env.local` > `.env` 순으로 앞의 값을 쓰고(값이 `undefined`인 `env` 항목은 없는 것으로 친다), 없는 파일은 건너뛴다.
 * `env`도 `process.env`도 바꾸지 않는다.
 */
export function loadEnv(cwd: string, env: Record<string, string | undefined>): Record<string, string | undefined> {
	const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
	return { ...readEnvFile(cwd, ".env"), ...readEnvFile(cwd, ".env.local"), ...defined };
}

/** `cwd`의 환경 변수 파일 `name`의 값. 파일이 없으면 비어 있다. */
function readEnvFile(cwd: string, name: string): Record<string, string | undefined> {
	const file = path.join(cwd, name);
	return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
}
