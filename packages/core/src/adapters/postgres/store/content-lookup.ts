import type { Pool } from "pg";

/**
 * 플러그인이 읽는 본체 콘텐츠 조회(읽기 전용). 플러그인은 본체 표를 직접 읽지 않고 이 함수로 묻는다.
 * `@monti-cms/core/plugin/server`로 내보낸다.
 *
 * ```ts
 * const lookup = createContentLookup(getCmsDatabase());
 * await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: ["hello"], excludeEntryId: id });
 * ```
 */

export interface SlugsInUseParams {
	readonly collection: string;
	readonly locale: string;
	/** 알아볼 주소. 빈 배열이면 묻지 않는다. */
	readonly slugs: readonly string[];
	/** 이 항목이 쓰는 주소는 빼고 본다(고치는 글 자신). */
	readonly excludeEntryId?: string;
}

export interface ContentLookup {
	/**
	 * 주소 중 같은 컬렉션·언어에서 이미 쓰는 것(지금 주소·예약·예전 주소·삭제된 글의 주소). 저장할 때 주소 충돌
	 * (`slug_conflict`)이 나는 주소와 같다.
	 */
	slugsInUse(params: SlugsInUseParams): Promise<Set<string>>;
}

export function createContentLookup({ pool, schema }: { readonly pool: Pool; readonly schema: string }): ContentLookup {
	return {
		slugsInUse: async ({ collection, locale, slugs, excludeEntryId }) => {
			if (slugs.length === 0) return new Set();
			const res = await pool.query<{ slug: string }>(
				`SELECT slug FROM "${schema}".content_addresses
				 WHERE collection = $1 AND locale = $2 AND slug = ANY($3::text[])
				   AND ($4::uuid IS NULL OR entry_id IS DISTINCT FROM $4::uuid)`,
				[collection, locale, [...slugs], excludeEntryId ?? null],
			);
			return new Set(res.rows.map((row) => row.slug));
		},
	};
}
