import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

export interface WithCmsOptions {
	/** 사이트 설정 파일 경로(서버·브라우저 공용). 프로젝트 루트 기준 상대 경로다(예: `./src/cms.config.ts`). */
	readonly config: string;
	/** 서버 설정 파일 경로(저장소·로그인 연결, 서버 전용). 예: `./src/cms.server.ts`. */
	readonly server: string;
}

const PACKAGES = ["@monti-cms/core"];
/** 본체 쪽 패키지. 이 패키지들과 CMS 플러그인 패키지의 선택 peer 의존성만 본다. */
const CORE_PACKAGES = ["@monti-cms/core", "@monti-cms/admin"];
/** CMS 플러그인 패키지가 `package.json`에 적는 표시(`"cmsPlugin": true`). 이름은 따지지 않는다. */
export const PLUGIN_MARKER = "cmsPlugin";
/** 설치하지 않은 선택 의존성 대신 잇는 모듈(불러오면 설치하라는 오류를 낸다). */
export const MISSING_OPTIONAL_MODULE = "@monti-cms/core/stubs/missing-optional";

const readJson = (file: string): Record<string, unknown> | undefined => {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return undefined;
	}
};

/**
 * `from` 폴더에서 위로 올라가며 `node_modules/<name>`이 있는가(Node·번들러의 패키지 찾기와 같은 순서).
 * `boundary`(Turbopack `root`)가 있으면 그 밖은 보지 않는다(Turbopack도 보지 않는다).
 */
const installedFrom = (from: string, name: string, boundary?: string): boolean => {
	for (let dir = from; ; dir = path.dirname(dir)) {
		if (boundary && path.relative(boundary, dir).startsWith("..")) return false;
		if (existsSync(path.join(dir, "node_modules", name, "package.json"))) return true;
		if (path.dirname(dir) === dir) return false;
	}
};

/**
 * 앱이 설치한 CMS 패키지(본체·관리자 패키지와 `package.json`에 `"cmsPlugin": true`를 적은 플러그인 패키지)의 선택 peer 의존성
 * (`peerDependenciesMeta.optional`) 중 설치하지 않은 것.
 * 예: 블록 확장의 Mermaid 미리보기는 `mermaid`를 미리보기를 열 때만 불러오지만, 번들러는 쓰지 않는 확장의 `import("mermaid")`도
 * 찾으려 해서 설치하지 않으면 빌드가 멈춘다.
 */
export function missingOptionalPeers(root: string, boundary?: string): string[] {
	const app = readJson(path.join(root, "package.json"));
	const deps = { ...(app?.dependencies as object), ...(app?.devDependencies as object) };
	const missing = new Set<string>();
	for (const name of Object.keys(deps)) {
		const dir = path.join(root, "node_modules", name);
		const meta = readJson(path.join(dir, "package.json"));
		if (!CORE_PACKAGES.includes(name) && meta?.[PLUGIN_MARKER] !== true) continue;
		const optional = Object.entries((meta?.peerDependenciesMeta ?? {}) as Record<string, { optional?: boolean }>)
			.filter(([, value]) => value?.optional)
			.map(([peer]) => peer);
		if (optional.length === 0) continue;
		const real = realpathSync(dir);
		for (const peer of optional) if (!installedFrom(real, peer, boundary)) missing.add(peer);
	}
	return [...missing].sort();
}

/**
 * Next 설정에 CMS 연결을 더한다. 패키지 소스(TypeScript)를 앱과 함께 빌드하고, CMS 코드가 읽는 `@cms-config`·
 * `@cms-server` 별칭을 설정 파일로 잇는다. 타입 검사용 별칭은 앱의 `tsconfig.json` `paths`에 따로 적는다.
 * CMS 패키지의 선택 의존성 중 설치하지 않은 것(예: 블록 확장의 `mermaid`)은 빈 모듈로 잇는다(그 기능을 쓰면 설치하라는 오류).
 */
export function withCms(nextConfig: NextConfig, options: WithCmsOptions): NextConfig {
	const relative = (file: string) => (file.startsWith(".") ? file : `./${file}`);
	const aliases = { "@cms-config": options.config, "@cms-server": options.server };
	const turbopackRoot = nextConfig.turbopack?.root;
	const missing = missingOptionalPeers(
		process.cwd(),
		turbopackRoot ? realpathSync(path.resolve(process.cwd(), turbopackRoot)) : undefined,
	);
	const userWebpack = nextConfig.webpack;

	return {
		...nextConfig,
		// Next `basePath`를 서버·브라우저 번들에 알린다(`cmsApiUrl()`·`withBasePath()`가 읽는다). 사이트 코드는 따로 할 일이 없다.
		env: { ...nextConfig.env, NEXT_PUBLIC_CMS_BASE_PATH: nextConfig.basePath?.replace(/\/+$/, "") ?? "" },
		transpilePackages: [...new Set([...(nextConfig.transpilePackages ?? []), ...PACKAGES])],
		turbopack: {
			...nextConfig.turbopack,
			resolveAlias: {
				...Object.fromEntries(missing.map((name) => [name, MISSING_OPTIONAL_MODULE])),
				...nextConfig.turbopack?.resolveAlias,
				...Object.fromEntries(Object.entries(aliases).map(([alias, file]) => [alias, relative(file)])),
			},
		},
		webpack: (config, context) => {
			config.resolve ??= {};
			// 앱이 설치한 본체 패키지 안의 빈 모듈(`MISSING_OPTIONAL_MODULE`과 같은 파일).
			const stub = path.join(process.cwd(), "node_modules", "@monti-cms", "core", "stubs", "missing-optional.cjs");
			config.resolve.alias = {
				...Object.fromEntries(missing.map((name) => [name, stub])),
				...config.resolve.alias,
				...Object.fromEntries(
					Object.entries(aliases).map(([alias, file]) => [alias, path.resolve(process.cwd(), file)]),
				),
			};
			return userWebpack ? userWebpack(config, context) : config;
		},
	};
}
