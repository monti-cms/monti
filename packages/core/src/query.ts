import { type RawBuilder, sql } from "kysely";
import { z } from "zod";

/** A search's words as an `ilike` pattern: found anywhere in the text, with the pattern's own signs taken as letters. */
export const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/**
 * The days a date column is filtered by, in every list (doc 06): today, the last 7 or 30 days, or from one day to another (one day is a range of
 * itself). Days are the admin's, so a query that takes one takes the admin's time zone too.
 */
export const DateRange = z.union([z.enum(["today", "7d", "30d"]), z.object({ from: z.iso.date(), to: z.iso.date() })]);
export type DateRange = z.infer<typeof DateRange>;

/** The condition of a date range on a timestamp column, with days counted in `zone`. */
export function dateRangeSql(
	column: RawBuilder<unknown>,
	range: DateRange,
	zone: string,
	now: Date,
): RawBuilder<unknown> {
	if (range === "today")
		return sql`${column} >= (date_trunc('day', ${now}::timestamptz at time zone ${zone}) at time zone ${zone})`;
	if (range === "7d" || range === "30d")
		return sql`${column} >= ${new Date(now.getTime() - (range === "7d" ? 7 : 30) * 86_400_000)}`;
	return sql`(${column} >= (${range.from}::date::timestamp at time zone ${zone})
		and ${column} < ((${range.to}::date + 1)::timestamp at time zone ${zone}))`;
}
