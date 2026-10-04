import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, isTransactionConflict, isUniqueViolation } from "./errors";
import { type FolderRow, mapFolderRow } from "./rows";
import type { Folder } from "./types";

const mapFolderError = (err: unknown) => {
	// §3.3: 같은 부모 안의 중복 이름은 이름을 바꾸도록 안내한다.
	if (isUniqueViolation(err, "folders_sibling_name_idx")) {
		return new CmsError("A folder with the same name already exists here", "folder_name_conflict");
	}
	return err;
};

/** §3.3 컬렉션별 가상 폴더. 글 주소·태그·카테고리와 무관한 관리자 전용 분류다. */
export function createFolderOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

	const assertParent = async (client: PoolClient, parentId: string, collection: string) => {
		const res = await client.query<{ collection: string }>(
			`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
			[parentId],
		);
		if (res.rows[0]?.collection !== collection) throw new CmsError("Invalid parent", "invalid_input");
	};

	return {
		createFolder: async (params: {
			collection: string;
			parentId: string | null;
			name: string;
			position?: number;
		}): Promise<Folder> =>
			withTransaction(
				pool,
				async (client) => {
					if (params.parentId) await assertParent(client, params.parentId, params.collection);
					const folder: Folder = {
						id: randomUUID(),
						collection: params.collection,
						parentId: params.parentId,
						name: params.name,
						position: params.position ?? 0,
						version: 1,
					};
					await client.query(
						`INSERT INTO "${qSchema}".folders (id, collection, parent_id, name, position, version)
						 VALUES ($1, $2, $3, $4, $5, 1)`,
						[folder.id, folder.collection, folder.parentId, folder.name, folder.position],
					);
					return folder;
				},
				{ mapError: mapFolderError },
			),

		/** HTTP 계층은 항상 `expectedVersion`을 요구한다. 저장소는 주어졌을 때만 비교한다. */
		updateFolder: async (params: {
			id: string;
			expectedVersion?: number;
			name?: string;
			parentId?: string | null;
			position?: number;
		}): Promise<Folder> =>
			withTransaction(
				pool,
				async (client) => {
					const currRes = await client.query<FolderRow>(
						`SELECT id, collection, parent_id, name, position, version FROM "${qSchema}".folders WHERE id = $1 FOR UPDATE`,
						[params.id],
					);
					const curr = currRes.rows[0];
					if (!curr) throw new CmsError("Not found", "not_found");
					if (params.expectedVersion !== undefined && curr.version !== params.expectedVersion) {
						throw new CmsError("Conflict", "conflict", curr.version);
					}

					const next: FolderRow = {
						...curr,
						name: params.name ?? curr.name,
						parent_id: params.parentId !== undefined ? params.parentId : curr.parent_id,
						position: params.position ?? curr.position,
						version: curr.version + 1,
					};

					if (next.parent_id) {
						await assertParent(client, next.parent_id, curr.collection);
						// 순환 구조를 거부한다: 새 부모의 조상 중에 자기 자신이 있으면 안 된다.
						let ancestor: string | null = next.parent_id;
						while (ancestor) {
							if (ancestor === params.id) throw new CmsError("Cycle", "invalid_input");
							const ancestorRes: { rows: { parent_id: string | null }[] } = await client.query(
								`SELECT parent_id FROM "${qSchema}".folders WHERE id = $1`,
								[ancestor],
							);
							ancestor = ancestorRes.rows[0]?.parent_id ?? null;
						}
					}

					await client.query(
						`UPDATE "${qSchema}".folders SET name = $1, parent_id = $2, position = $3, version = $4 WHERE id = $5`,
						[next.name, next.parent_id, next.position, next.version, params.id],
					);
					return mapFolderRow(next);
				},
				{
					mapError: (err) =>
						isTransactionConflict(err) ? new CmsError("Cycle", "invalid_input") : mapFolderError(err),
				},
			),

		/**
		 * 폴더 삭제(§3.3). 직접 속한 글과 자식 폴더를 부모로 옮긴다. 글은 삭제하지 않는다.
		 * 옮긴 자식 폴더 이름이 부모에서 겹치면 먼저 이름을 바꾸도록 409로 거부한다.
		 */
		deleteFolder: async (params: { id: string; expectedVersion?: number }): Promise<void> =>
			withTransaction(
				pool,
				async (client) => {
					const currRes = await client.query<{ parent_id: string | null; version: number }>(
						`SELECT parent_id, version FROM "${qSchema}".folders WHERE id = $1 FOR UPDATE`,
						[params.id],
					);
					const curr = currRes.rows[0];
					if (!curr) throw new CmsError("Not found", "not_found");
					if (params.expectedVersion !== undefined && curr.version !== params.expectedVersion) {
						throw new CmsError("Conflict", "conflict", curr.version);
					}

					await client.query(`UPDATE "${qSchema}".folders SET parent_id = $1 WHERE parent_id = $2`, [
						curr.parent_id,
						params.id,
					]);
					await client.query(`UPDATE "${qSchema}".entries SET folder_id = $1 WHERE folder_id = $2`, [
						curr.parent_id,
						params.id,
					]);
					await client.query(`DELETE FROM "${qSchema}".folders WHERE id = $1`, [params.id]);
				},
				{ mapError: mapFolderError },
			),

		/** 폴더 삭제 전 미리보기: 직접 속한 글 수와 자식 폴더(§3.3 "내용물을 미리 보여준 뒤"). */
		getFolderContents: async (params: { id: string }): Promise<{ entryCount: number; childFolders: Folder[] }> => {
			const [entries, children] = await Promise.all([
				pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${qSchema}".entries WHERE folder_id = $1`, [
					params.id,
				]),
				pool.query<FolderRow>(
					`SELECT id, collection, parent_id, name, position, version FROM "${qSchema}".folders
					 WHERE parent_id = $1 ORDER BY position ASC, id ASC`,
					[params.id],
				),
			]);
			return { entryCount: Number(entries.rows[0]?.count ?? 0), childFolders: children.rows.map(mapFolderRow) };
		},

		listFolders: async (params: { collection: string }): Promise<Folder[]> => {
			const res = await pool.query<FolderRow>(
				`SELECT id, collection, parent_id, name, position, version
				 FROM "${qSchema}".folders
				 WHERE collection = $1
				 ORDER BY parent_id NULLS FIRST, position ASC, id ASC`,
				[params.collection],
			);
			return res.rows.map(mapFolderRow);
		},
	};
}
