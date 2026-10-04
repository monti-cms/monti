import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Node 모듈 해석 훅(`register.ts`·`monti migrate`가 등록한다). 설정 별칭만 앱의 파일로 바꾸고 나머지는 그대로 넘긴다.
 * 파일 경로는 등록할 때 넘긴 값(`initialize`), 없으면 `CMS_CONFIG_PATH`·`CMS_SERVER_PATH`(기본 `./cms.config.ts`·
 * `./cms.server.ts`, 현재 폴더 기준)다.
 */
let aliases: Readonly<Record<string, string>> = {
	"@cms-config": process.env.CMS_CONFIG_PATH ?? "./cms.config.ts",
	"@cms-server": process.env.CMS_SERVER_PATH ?? "./cms.server.ts",
};

/** 등록할 때 넘긴 별칭 파일(`register(url, { data: { aliases } })`). */
export const initialize = (data?: { aliases?: Readonly<Record<string, string>> }) => {
	if (data?.aliases) aliases = { ...aliases, ...data.aliases };
};

type Resolve = (
	specifier: string,
	context: unknown,
	next: (specifier: string, context: unknown) => Promise<unknown>,
) => Promise<unknown>;

export const resolve: Resolve = (specifier, context, next) => {
	const file = aliases[specifier];
	return file ? next(pathToFileURL(path.resolve(process.cwd(), file)).href, context) : next(specifier, context);
};
