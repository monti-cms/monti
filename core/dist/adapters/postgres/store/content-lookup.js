export function createContentLookup({ pool, schema }) {
    return {
        slugsInUse: async ({ collection, locale, slugs, excludeEntryId }) => {
            if (slugs.length === 0)
                return new Set();
            const res = await pool.query(`SELECT slug FROM "${schema}".content_addresses
				 WHERE collection = $1 AND locale = $2 AND slug = ANY($3::text[])
				   AND ($4::uuid IS NULL OR entry_id IS DISTINCT FROM $4::uuid)`, [collection, locale, [...slugs], excludeEntryId ?? null]);
            return new Set(res.rows.map((row) => row.slug));
        },
    };
}
