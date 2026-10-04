import type { PoolClient } from "pg";
import { isItemCollection } from "../../../core/collections";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import { loadEntry, lockEntryForUpdate } from "./rows";
import type { Entry, EntryStatus } from "./types";

type LifecycleParams = { id: string; expectedVersion: number };

/**
 * §5.3 상태 전환. 허용되지 않은 출발 상태는 `invalid_status`(409)로 거부한다 —
 * 예컨대 발행된 글에 `보관 해제`나 `복원`을 눌러 공개가 조용히 내려가는 일을 막는다.
 */
export function createLifecycleOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema } = ctx;

	const transition = (
		params: LifecycleParams,
		allowedFrom: readonly EntryStatus[],
		apply: (
			client: PoolClient,
			locked: { version: number; collection: string; status: EntryStatus; translation_group_id: string },
		) => Promise<void>,
	): Promise<Entry> =>
		withTransaction(
			pool,
			async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				if (!allowedFrom.includes(locked.status)) {
					throw new CmsError(`Cannot change status from ${locked.status}`, "invalid_status", locked.version);
				}
				await apply(client, locked);
				return loadEntry(client, params.id, qSchema);
			},
			{ mapError: mapEntryWriteError },
		);

	/**
	 * 원문이면 같은 묶음의 번역본(자기 제외)을 잠그고 돌려준다. 번역본이면 빈 목록이다.
	 * 원문의 상태 전환은 묶음 전체에 적용한다(v3 번역 화면 결정 3).
	 */
	const lockTranslations = async (client: PoolClient, id: string) =>
		(
			await client.query<{ id: string; status: EntryStatus; version: number; trashed_at: Date | null }>(
				`SELECT id, status, version, trashed_at FROM "${qSchema}".entries
				 WHERE translation_group_id = $1 AND id <> $1 ORDER BY id FOR UPDATE`,
				[id],
			)
		).rows;

	/** 번역본들의 상태를 바꾸고 판을 올린다. 열어 둔 편집 화면이 충돌로 알아차린다. */
	const setMembersStatus = async (client: PoolClient, ids: readonly string[], status: EntryStatus, extra = "") => {
		if (ids.length === 0) return;
		await client.query(
			`UPDATE "${qSchema}".entries SET status = $1, version = version + 1${extra} WHERE id = ANY($2::uuid[])`,
			[status, ids],
		);
	};

	/** 공개된 적 있는 주소는 재사용 방지 기록만 남기고, 예약 주소는 해제한 뒤 콘텐츠를 지운다. */
	const deleteEntryRow = async (client: PoolClient, id: string) => {
		await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [id]);
		await client.query(
			`UPDATE "${qSchema}".content_addresses SET type = 'deleted', entry_id = NULL WHERE entry_id = $1`,
			[id],
		);
		await client.query(`DELETE FROM "${qSchema}".entries WHERE id = $1`, [id]);
	};

	return {
		/** 초안/발행 → 보관. 공개를 끝낸다. record 컬렉션은 보관이 없다. */
		archiveEntry: (params: LifecycleParams) =>
			transition(params, ["draft", "published"], async (client, locked) => {
				if (isItemCollection(locked.collection)) {
					throw new CmsError("Record collections cannot be archived", "invalid_status", locked.version);
				}
				await client.query(`UPDATE "${qSchema}".entries SET status = 'archived', version = $1 WHERE id = $2`, [
					locked.version + 1,
					params.id,
				]);
				const members = (await lockTranslations(client, params.id)).filter(
					(member) => member.status === "draft" || member.status === "published",
				);
				const ids = members.map((member) => member.id);
				await setMembersStatus(client, ids, "archived");
			}),

		/** 보관 → 초안. 자동으로 다시 공개하지 않는다. */
		unarchiveEntry: (params: LifecycleParams) =>
			transition(params, ["archived"], async (client, locked) => {
				await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', version = $1 WHERE id = $2`, [
					locked.version + 1,
					params.id,
				]);
				const members = (await lockTranslations(client, params.id)).filter((member) => member.status === "archived");
				await setMembersStatus(
					client,
					members.map((member) => member.id),
					"draft",
				);
			}),

		/**
		 * → 휴지통. 공개를 끝낸다.
		 * 사용 중인 분류 항목(record 컬렉션: 태그·카테고리 등)은 참조를 먼저 해제해야 한다(§6.1).
		 */
		trashEntry: (params: LifecycleParams) =>
			transition(params, ["draft", "published", "archived"], async (client, locked) => {
				if (isItemCollection(locked.collection)) {
					await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: true });
				}
				await client.query(
					`UPDATE "${qSchema}".entries SET status = 'trashed', trashed_at = NOW(), version = $1 WHERE id = $2`,
					[locked.version + 1, params.id],
				);
				// 같은 트랜잭션의 NOW()는 같은 값이다. 복원할 때 이 시각으로 "함께 버린 번역본"을 찾는다.
				const ids = (await lockTranslations(client, params.id))
					.filter((member) => member.status !== "trashed")
					.map((member) => member.id);
				await setMembersStatus(client, ids, "trashed", ", trashed_at = NOW()");
			}),

		/**
		 * 휴지통 → 복원. publish 컬렉션은 초안으로, record 컬렉션은 현재 값과 관계를 검증한 뒤
		 * 활성(공개) 레코드로 되돌린다(§5.3).
		 */
		restoreEntry: (params: LifecycleParams) =>
			transition(params, ["trashed"], async (client, locked) => {
				const isSource = locked.translation_group_id === params.id;
				if (!isSource) {
					// 원문 없이 번역본만 살리면 목록(원문 한 줄)에 보이지 않고 공통 값도 없다.
					const source = await client.query<{ status: EntryStatus }>(
						`SELECT status FROM "${qSchema}".entries WHERE id = $1`,
						[locked.translation_group_id],
					);
					if (source.rows[0]?.status === "trashed") {
						throw new CmsError("Restore the source first", "source_trashed", locked.version);
					}
				}
				const trashedAt = isSource
					? (
							await client.query<{ trashed_at: Date | null }>(
								`SELECT trashed_at FROM "${qSchema}".entries WHERE id = $1`,
								[params.id],
							)
						).rows[0]?.trashed_at
					: null;
				const version = locked.version + 1;
				await client.query(
					`UPDATE "${qSchema}".entries SET status = 'draft', trashed_at = NULL, version = $1 WHERE id = $2`,
					[version, params.id],
				);
				if (isItemCollection(locked.collection)) {
					await publishing.publishWithinTransaction(client, params.id, { expectedVersion: version });
				}
				// 원문과 함께 버린 번역본만 되살린다. 따로 지운 번역본은 휴지통에 남는다.
				if (isSource && trashedAt) {
					const ids = (await lockTranslations(client, params.id))
						.filter((member) => member.status === "trashed" && member.trashed_at?.getTime() === trashedAt.getTime())
						.map((member) => member.id);
					await setMembersStatus(client, ids, "draft", ", trashed_at = NULL");
				}
			}),

		/**
		 * 휴지통 항목의 영구 삭제(§5.3, §6.2). 다른 콘텐츠가 참조하면 거부한다.
		 * 공개된 적 있는 주소는 재사용 방지 기록(`deleted`)만 남기고, 공개된 적 없는 예약 주소는 해제한다.
		 */
		permanentDeleteEntry: async (params: LifecycleParams): Promise<void> =>
			withTransaction(pool, async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				if (locked.status !== "trashed") {
					throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status", locked.version);
				}
				await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: false });
				// 원문을 지우면 번역본도 함께 지운다(v3). 휴지통 밖 번역본이 남아 있으면 공통 값을 잃으므로 거부한다.
				const members = await lockTranslations(client, params.id);
				const alive = members.filter((member) => member.status !== "trashed");
				if (alive.length > 0) {
					const translations = await client.query<{ id: string; locale: string }>(
						`SELECT id, locale FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY locale`,
						[alive.map((member) => member.id)],
					);
					throw new CmsError("Delete the translations first", "has_translations", locked.version, {
						translations: translations.rows,
					});
				}
				for (const member of members) {
					await publishing.assertNotReferenced(client, member.id, { ignoreTrashedSources: false });
					await deleteEntryRow(client, member.id);
				}
				await deleteEntryRow(client, params.id);
			}),
	};
}
