import type { Kysely } from "kysely";
import type { Database } from "../../db/types";
import type { StorageAdapter } from "../../engine/types";
import { tryLockStorageKey } from "./queries";

/** 저장소에서 지우지 못한 임시 파일의 키와 그 오류. */
export interface RemoveLooseFilesFailure {
	key: string;
	error: unknown;
}

/** `removeLooseFiles`가 지운 키들과 지우지 못한 키들. */
export interface RemoveLooseFilesResult {
	removed: string[];
	failed: RemoveLooseFilesFailure[];
}

/**
 * `loose_files`에서 `remove_after`가 지난 파일을 저장소에서 지우고, 지운 뒤 그 행을 지운다. 저장소가 지우지 못한 파일은
 * 다음 실행을 위해 행을 남기고 `failed`에 담으며, 나머지는 그대로 지운다. 미디어 등록이 잡고 있는 키는 건너뛴다.
 */
export async function removeLooseFiles({
	db,
	storage,
}: {
	db: Kysely<Database>;
	storage: StorageAdapter;
}): Promise<RemoveLooseFilesResult> {
	// 한 실행의 기준 시각은 하나다: 목록을 고를 때와 키마다 다시 확인할 때 같은 시각으로 비교한다.
	const now = new Date();
	const due = await db.selectFrom("loose_files").select("key").where("remove_after", "<", now).execute();
	const result: RemoveLooseFilesResult = { removed: [], failed: [] };
	for (const { key } of due) {
		const outcome = await removeOneLooseFile(db, storage, key, now).catch((error: unknown) => ({ error }));
		if (outcome === "removed") result.removed.push(key);
		else if (outcome !== "skipped") result.failed.push({ key, error: outcome.error });
	}
	return result;
}

/**
 * 키 하나를 그 키의 잠금 아래에서 지운다. 다른 쓰기(등록·교체·삭제·정리)가 키를 잡고 있거나 그사이 행이 없어졌으면
 * 건너뛴다. 저장소 오류는 트랜잭션을 되돌려 행을 남기고 그대로 던진다.
 */
async function removeOneLooseFile(
	db: Kysely<Database>,
	storage: StorageAdapter,
	key: string,
	now: Date,
): Promise<"removed" | "skipped"> {
	return db.transaction().execute(async (tx) => {
		if (!(await tryLockStorageKey(tx, key))) return "skipped";
		const row = await tx
			.selectFrom("loose_files")
			.select("key")
			.where("key", "=", key)
			.where("remove_after", "<", now)
			.executeTakeFirst();
		if (row === undefined) return "skipped";
		await storage.remove(key);
		await tx.deleteFrom("loose_files").where("key", "=", key).execute();
		return "removed";
	});
}
