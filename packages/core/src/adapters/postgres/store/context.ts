import type { Pool, PoolClient } from "pg";
import type { Entry } from "./types";

export type ContentStoreHooks = {
	beforePublishCommit?: (entry: Entry, txClient: PoolClient) => Promise<void>;
};

/** 저장소 모듈이 공유하는 연결·스키마. SQL의 스키마 이름은 검증된 식별자만 쓴다. */
export interface StoreContext {
	readonly pool: Pool;
	readonly qSchema: string;
	readonly hooks: ContentStoreHooks;
}

export type Queryable = Pool | PoolClient;

export function validateSchemaName(schema?: string): string {
	const s = schema ?? "public";
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
		throw new Error("Invalid schema name");
	}
	return s;
}

/**
 * 트랜잭션 하나를 연다. 실패하면 되돌리고 `mapError`로 안정적인 오류로 바꿔 던진다.
 * 이미 끝난 트랜잭션의 ROLLBACK 오류는 원래 오류를 가리지 않게 무시한다.
 */
export async function withTransaction<T>(
	pool: Pool,
	fn: (client: PoolClient) => Promise<T>,
	options?: { begin?: string; mapError?: (err: unknown) => unknown },
): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query(options?.begin ?? "BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (err) {
		try {
			await client.query("ROLLBACK");
		} catch {
			// 이미 종료된 트랜잭션은 무시한다.
		}
		throw options?.mapError ? options.mapError(err) : err;
	} finally {
		client.release();
	}
}
