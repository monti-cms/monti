import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** `--env-file`을 주지 않았을 때 읽는 파일(Next와 같은 순서: `.env.local`이 `.env`보다 먼저다). */
export const DEFAULT_ENV_FILES = [".env.local", ".env"] as const;

/**
 * 환경 파일을 읽어 `env`에 넣는다. **이미 있는 값은 바꾸지 않는다**(셸에서 준 값이 이기고, 먼저 읽은 파일이 이긴다).
 * 읽은 파일(`cwd` 기준 경로)을 돌려준다. 없는 기본 파일은 건너뛰고, 직접 고른 파일이 없으면 오류다.
 */
export function loadEnvFiles(
	cwd: string,
	files: readonly string[] | undefined,
	env: Record<string, string | undefined> = process.env,
): string[] {
	const chosen = files ?? DEFAULT_ENV_FILES;
	const loaded: string[] = [];
	for (const file of chosen) {
		const full = path.resolve(cwd, file);
		if (!existsSync(full)) {
			if (files) throw new Error(`env file not found: ${file}`);
			continue;
		}
		const values = parseEnv(readFileSync(full, "utf8"));
		for (const [key, value] of Object.entries(values)) {
			if (env[key] === undefined && value !== undefined) env[key] = value;
		}
		loaded.push(file);
	}
	return loaded;
}
