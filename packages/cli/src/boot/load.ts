import { existsSync } from "node:fs";
import path from "node:path";
import type { MontiConfig, Schema } from "@monti-cms/core";
import { createJiti } from "jiti";
import type { LoadedProject } from "../migrate/runner";
import { CliError } from "../parse/error";

/** 파일 하나를 불러와 그 모듈(export 이름마다 값)을 돌려주는 함수. */
type ModuleLoader = (file: string) => Promise<Record<string, unknown>>;

/** `loadProjectFiles`에 넘기는 것. 두 경로는 `cwd`에서 본 상대 경로여도 된다. */
interface LoadOptions {
	cwd: string;
	configPath: string;
	schemaPath: string;
	/** 파일을 불러오는 함수. 없으면 jiti로 불러온다. */
	loader?: ModuleLoader;
}

/** 기본 로더가 쓰는 jiti. */
const jiti = createJiti(import.meta.url);

/** jiti로 TypeScript 파일을 불러온다. */
function importWithJiti(file: string): Promise<Record<string, unknown>> {
	return jiti.import<Record<string, unknown>>(file);
}

/**
 * `cwd`에서 본 설정 파일과 스키마 파일을 불러와 각 파일의 `default` export와 두 파일의 절대 경로를 돌려준다. 파일이 없거나
 * `default` export가 없으면 실행 오류다.
 */
export async function loadProjectFiles(options: LoadOptions): Promise<LoadedProject> {
	const load = options.loader ?? importWithJiti;
	const configFile = path.resolve(options.cwd, options.configPath);
	const schemaFile = path.resolve(options.cwd, options.schemaPath);
	const config = await defaultExport<MontiConfig>(load, configFile, "설정");
	const schema = await defaultExport<Schema>(load, schemaFile, "스키마");
	return { config, schema, configFile, schemaFile };
}

/**
 * `file`의 `default` export. 파일이 없거나 `default` export가 없으면 실행 오류다. jiti는 `default` export가 없는 모듈에도
 * 모듈 자신을 `default`로 돌려주므로(interopDefault), 값이 아니라 모듈이 `default`를 직접 가졌는지로 가린다.
 */
async function defaultExport<T>(load: ModuleLoader, file: string, label: string): Promise<T> {
	if (!existsSync(file)) throw new CliError(1, `${label} 파일이 없다: ${file}`);
	const loaded = await load(file);
	if (!Object.hasOwn(loaded, "default")) throw new CliError(1, `${label} 파일에 default export가 없다: ${file}`);
	return loaded.default as T;
}
