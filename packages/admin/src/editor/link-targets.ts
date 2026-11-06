import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation, useRead } from "../operations/use-operation";
import type { SchemaRead } from "../screens/settings/schema-draft";

/** A body link to an entry of this site: its translation group, so the link holds when the entry's address changes (doc 03). */
export const ENTRY_LINK = "monti:entry/";

/** An entry a link can point at, as the link card lists it. */
export type LinkTarget = { group: string; title: string; collection: string; draft: boolean };

type Row = { translationGroup: string; title: string; state: string; updatedAt: string };

const ROWS = 5;

/**
 * What typed words are: an address links out (`https://`, `mailto:`, `/`, `#`, or a bare domain, which gets `https://`), anything else searches the
 * site's entries. `null` when it is not an address.
 */
export function addressOf(text: string): string | null {
	const typed = text.trim();
	if (typed === "" || /\s/.test(typed)) return null;
	if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(typed)) return typed;
	if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(typed)) return `https://${typed}`;
	return null;
}

/**
 * The entries the link card offers (T63): with nothing typed, the ones changed last; with words typed, the ones whose title has them; and the entry an
 * entry link already points at. It reads each document collection with the list's own query (`entries.query`), so what the card finds is what the
 * list finds.
 */
export function useLinkTargets({ open, text, href }: { open: boolean; text: string; href: string }) {
	const { t } = useAdmin();
	const schema = useRead<SchemaRead>("schema.read", {}, { skip: !open });
	const query = useOperation<{ rows: Row[] }>("entries.query");
	const [found, setFound] = useState<LinkTarget[]>([]);
	const [linked, setLinked] = useState<LinkTarget | null>(null);
	const run = query.run;

	const collections = useMemo(
		() =>
			Object.entries(schema.data?.schema.collections ?? {})
				.filter(([, definition]) => definition.kind === "document")
				.map(([name]) => ({ name, label: schema.data?.adminValues[name]?.label ?? name })),
		[schema.data],
	);
	const group = href.startsWith(ENTRY_LINK) ? href.slice(ENTRY_LINK.length) : null;
	const search = addressOf(text) === null ? text.trim() : null;

	useEffect(() => {
		if (!open) return;
		if (collections.length === 0) return;
		let current = true;
		const read = async (input: (collection: string) => Record<string, unknown>) =>
			(
				await Promise.all(
					collections.map(async ({ name, label }) => {
						const answer = await run({ collection: name, ...input(name) });
						return answer.ok
							? answer.body.rows.map((row) => ({
									row,
									target: {
										group: row.translationGroup,
										title: row.title || t("list.untitled"),
										collection: label,
										draft: row.state === "draft",
									},
								}))
							: [];
					}),
				)
			).flat();
		// Typing waits a moment, so a word is looked up once, not at each letter.
		const timer = window.setTimeout(
			async () => {
				if (group) {
					const [hit] = await read(() => ({ filters: [{ on: "group", any: [group] }], pageSize: 1 }));
					if (current) setLinked(hit?.target ?? null);
				}
				if (search === null) {
					if (current) setFound([]);
					return;
				}
				const hits = await read(() => ({
					pageSize: ROWS,
					sort: { by: "updatedAt", dir: "desc" },
					...(search ? { search: { text: search, in: "title" } } : {}),
				}));
				hits.sort((a, b) => b.row.updatedAt.localeCompare(a.row.updatedAt));
				if (current) setFound(hits.slice(0, ROWS).map((hit) => hit.target));
			},
			search ? 150 : 0,
		);
		return () => {
			current = false;
			window.clearTimeout(timer);
		};
	}, [open, collections, group, search, run, t]);

	return { found, linked: group ? linked : null, recent: search === "" };
}
