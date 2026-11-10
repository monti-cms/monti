import { type RawBuilder, sql } from "kysely";

/**
 * The counts behind every view of a translation's state (doc 04, 04-4): the list's translation filters and facets, the language tabs' dots and the
 * agent's `translations.status` all read these, so they cannot disagree. `x` is the translation's alias; `sp` the source's published copy, joined
 * with `sourceJoin`.
 */
const blocksOf = (x: string) => sql`jsonb_array_elements(coalesce(${sql.ref(`${x}.doc`)} -> 'blocks', '[]'::jsonb))`;

/** The source entry (`s`) of `x`'s group and what the site shows of it (`sp`). */
export const sourceJoin = (x: string, source: string) => sql`
	left join entries s on s.translation_group = ${sql.ref(`${x}.translation_group`)} and s.locale = ${source} and s.trashed_at is null
	left join entry_published sp on sp.entry_id = s.id`;

/**
 * How many marks a translation has (`marksOf` and `fieldMarksOf` in SQL): paired blocks whose source block changed (not `followSource`) or was removed, published source blocks it
 * neither pairs nor left out, and fields whose source value moved on from the one it saw. A source that is not on the site marks nothing; the source itself has none.
 */
export const changesSql = (x: string, source: string): RawBuilder<number> => {
	const hashes = sql.ref("sp.block_hashes");
	const from = sql`(b.value -> 'link' ->> 'from')`;
	const sourceValue = sql`case when f.key = 'title' then to_jsonb(sp.title) else ${sql.ref("sp.values")} -> f.key end`;
	return sql<number>`(case when sp.entry_id is null or ${sql.ref(`${x}.locale`)} = ${source} then 0 else
		(select count(*) from ${blocksOf(x)} b where b.value ? 'link' and (not (${hashes} ? ${from})
			or (b.value -> 'link' ->> 'state' <> 'followSource' and ${hashes} ->> ${from} <> b.value -> 'link' ->> 'seen')))
		+ (select count(*) from jsonb_object_keys(${hashes}) k where not (${sql.ref(`${x}.translation_skips`)} ? k)
			and not exists (select 1 from ${blocksOf(x)} p where p.value -> 'link' ->> 'from' = k))
		+ (select count(*) from jsonb_each(${sql.ref(`${x}.translation_seen`)}) f
			where f.value is distinct from coalesce(nullif(nullif(${sourceValue}, '""'::jsonb), '[]'::jsonb), 'null'::jsonb))
	end)::int`;
};

/** How many of `x`'s blocks are still pending. */
export const pendingSql = (x: string): RawBuilder<number> =>
	sql<number>`(select count(*) from ${blocksOf(x)} b where b.value -> 'link' ->> 'state' = 'pending')::int`;

export type TranslationFilter = "missing" | "sourceChanged" | "upToDate";

/**
 * Whether a list row's group (`rep`) is missing a translation in one of `targets`, has one whose source changed, or is up to date in all of them
 * (doc 06, T52).
 */
export function translationSql(is: TranslationFilter, targets: string[], source: string): RawBuilder<boolean> {
	if (targets.length === 0) return sql<boolean>`${is === "upToDate"}`;
	const codes = sql.join(targets.map((code) => sql`${code}`));
	const missing = sql<boolean>`exists (select 1 from unnest(array[${codes}]::text[]) t(code) where not exists (
		select 1 from entries m where m.translation_group = rep.translation_group and m.trashed_at is null and m.locale = t.code))`;
	const changed = sql<boolean>`exists (select 1 from entries x ${sourceJoin("x", source)}
		where x.translation_group = rep.translation_group and x.trashed_at is null and x.locale in (${codes})
			and ${changesSql("x", source)} > 0)`;
	if (is === "missing") return missing;
	if (is === "sourceChanged") return changed;
	return sql<boolean>`not ${missing} and not ${changed}`;
}
