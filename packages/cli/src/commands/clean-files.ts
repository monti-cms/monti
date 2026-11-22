import { removeLooseFiles } from "@monti-cms/core";
import { withDb } from "../boot/connect";
import { loadEnv } from "../boot/env";
import { type ParsedArgs, rejectUnusedArgs } from "../parse/args";
import { CliError } from "../parse/error";
import { writeJson } from "./output";
import { loadProject } from "./project";
import type { CliIo } from "./types";

/**
 * `monti clean-files`: 지울 때가 지난 임시 파일을 설정의 저장소와 DB에서 지우고 `null`을 쓴다. 설정에 저장소(`storage`)가
 * 없으면 DB에 연결하기 전에 실행 오류이고, `--dry-run`과 받지 않는 옵션, 남는 인자는 사용법 오류다.
 */
export async function cleanFiles(parsed: ParsedArgs, io: CliIo): Promise<void> {
	rejectUnusedArgs(parsed, "clean-files", { positionals: 1, dryRun: false });
	const env = loadEnv(io.cwd, io.env);
	const { storage } = (await loadProject(parsed, io)).config;
	if (storage === undefined) throw new CliError(1, "설정에 저장소(storage)가 없어 임시 파일을 정리할 수 없다");
	await withDb(env, (db) => removeLooseFiles({ db, storage }));
	writeJson(io, null);
}
