import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** 설정 별칭 이름. CMS 코드는 두 설정 파일을 이 이름으로 읽는다. */
export const CONFIG_ALIAS = "@cms-config";
export const SERVER_ALIAS = "@cms-server";

/** 주석·끝 쉼표가 있는 JSON(tsconfig)을 읽는다. 문자열 안의 `//`·`/*`는 건드리지 않는다. 못 읽으면 `undefined`. */
export function parseJsonc(text: string): unknown {
	let out = "";
	let inString = false;
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		const next = text[index + 1];
		if (inString) {
			out += char;
			if (char === "\\") {
				out += next ?? "";
				index++;
			} else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
		} else if (char === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") index++;
			out += "\n";
		} else if (char === "/" && next === "*") {
			index += 2;
			while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index++;
			index++;
		} else out += char;
	}
	try {
		return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
	} catch {
		return undefined;
	}
}

interface TsconfigLike {
	readonly compilerOptions?: {
		readonly baseUrl?: string;
		readonly paths?: Readonly<Record<string, readonly string[]>>;
	};
}

/** tsconfig `paths`에 적힌 별칭 파일(`cwd` 기준 상대 경로). 없으면 `undefined`. */
export function tsconfigAliasPath(cwd: string, alias: string): string | undefined {
	const file = path.join(cwd, "tsconfig.json");
	if (!existsSync(file)) return undefined;
	const tsconfig = parseJsonc(readFileSync(file, "utf8")) as TsconfigLike | undefined;
	const target = tsconfig?.compilerOptions?.paths?.[alias]?.[0];
	if (!target) return undefined;
	const base = path.resolve(cwd, tsconfig?.compilerOptions?.baseUrl ?? ".");
	return path.relative(cwd, path.resolve(base, target)) || target;
}

export interface ConfigPaths {
	/** 사이트 설정 파일(`cwd` 기준). */
	readonly config: string;
	/** 서버 설정 파일(`cwd` 기준). */
	readonly server: string;
}

const CANDIDATES = {
	config: ["cms.config.ts", "src/cms.config.ts"],
	server: ["cms.server.ts", "src/cms.server.ts"],
} as const;

/**
 * 두 설정 파일 자리. 고른 값(`--config`·`--server`) → 환경 변수(`CMS_CONFIG_PATH`·`CMS_SERVER_PATH`) → tsconfig `paths`의
 * 별칭 → 흔한 자리(`./cms.config.ts`·`./src/cms.config.ts`) 순서로 찾는다. 파일이 없으면 오류다.
 */
export function resolveConfigPaths(
	cwd: string,
	chosen: { config?: string; server?: string } = {},
	env: Record<string, string | undefined> = process.env,
): ConfigPaths {
	const find = (kind: "config" | "server", alias: string, envName: string, flag: string): string => {
		const given = chosen[kind] ?? env[envName];
		const found =
			given ??
			tsconfigAliasPath(cwd, alias) ??
			CANDIDATES[kind].find((candidate) => existsSync(path.join(cwd, candidate)));
		if (!found || !existsSync(path.resolve(cwd, found))) {
			throw new Error(
				found
					? `${alias} file not found: ${found}`
					: `cannot find ${CANDIDATES[kind][0]}; pass ${flag} <path> or set ${envName} (run \`monti init\` to create one)`,
			);
		}
		return found;
	};
	return {
		config: find("config", CONFIG_ALIAS, "CMS_CONFIG_PATH", "--config"),
		server: find("server", SERVER_ALIAS, "CMS_SERVER_PATH", "--server"),
	};
}
