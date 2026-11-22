import path from "node:path";
import { loadProjectFiles } from "../boot/load";
import type { LoadedProject } from "../migrate/runner";
import type { ParsedArgs } from "../parse/args";
import type { CliIo } from "./types";

/** 전역 옵션을 주지 않았을 때 작업 디렉터리에서 찾는 설정·스키마 파일과 마이그레이션 폴더. */
const defaultPaths = { config: "monti.config.ts", schema: "monti.schema.ts", migrations: "migrations" };

/** `--config`·`--schema`(없으면 기본 경로)의 설정·스키마 파일을 `io.loader`(없으면 기본 로더)로 불러온다. */
export function loadProject(parsed: ParsedArgs, io: CliIo): Promise<LoadedProject> {
	return loadProjectFiles({
		cwd: io.cwd,
		configPath: parsed.config ?? defaultPaths.config,
		schemaPath: parsed.schema ?? defaultPaths.schema,
		loader: io.loader,
	});
}

/** `--migrations`(없으면 기본 경로)의 마이그레이션 폴더 절대 경로. */
export function migrationsDir(parsed: ParsedArgs, io: CliIo): string {
	return path.resolve(io.cwd, parsed.migrations ?? defaultPaths.migrations);
}
