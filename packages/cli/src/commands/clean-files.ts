import { type RemoveLooseFilesFailure, removeLooseFiles } from "@monti-cms/core";
import { withDb } from "../boot/connect";
import { loadEnv } from "../boot/env";
import { type ParsedArgs, rejectUnusedArgs } from "../parse/args";
import { CliError } from "../parse/error";
import { writeJson } from "./output";
import { loadProject } from "./project";
import type { CliIo } from "./types";

/**
 * `monti clean-files`: 지울 때가 지난 임시 파일을 설정의 저장소와 DB에서 지우고 `null`을 쓴다. 설정에 저장소(`storage`)가
 * 없으면 DB에 연결하기 전에 실행 오류이고, 일부 파일을 지우지 못하면 나머지를 지운 뒤 실패한 키와 이유를 담은 실행 오류다.
 * `--dry-run`과 받지 않는 옵션, 남는 인자는 사용법 오류다.
 */
export async function cleanFiles(parsed: ParsedArgs, io: CliIo): Promise<void> {
	rejectUnusedArgs(parsed, "clean-files", { positionals: 1, dryRun: false });
	const env = loadEnv(io.cwd, io.env);
	const { storage } = (await loadProject(parsed, io)).config;
	if (storage === undefined) throw new CliError(1, "설정에 저장소(storage)가 없어 임시 파일을 정리할 수 없다");
	const { failed } = await withDb(env, (db) => removeLooseFiles({ db, storage }));
	if (failed.length > 0) {
		throw new CliError(1, `임시 파일 ${failed.length}건 삭제에 실패했다: ${failed.map(failureOf).join(", ")}`);
	}
	writeJson(io, null);
}

/** 지우지 못한 파일 하나: `<키> (<이유>)`. */
function failureOf(item: RemoveLooseFilesFailure): string {
	const reason = item.error instanceof Error ? item.error.message : String(item.error);
	return `${item.key} (${reason})`;
}
