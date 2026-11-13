import type { TextCheckResult } from "@monti-cms/core";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { blockTexts, type Found, fixInEditor, showInEditor } from "../../editor/text-check";
import { useOperation } from "../../operations/use-operation";
import type { SchemaRead } from "../settings/schema-draft";

/** How long the body rests before it is checked again: a check is a call to the server, and through it often to a service. */
const REST_MS = 800;

/** One plugin's cell of the status bar: its name and what it found in the body as it is now. */
export type TextCheckCell = { plugin: string; label: string; findings: Found[] };

/**
 * The plugins' text checks of the body (doc 03, the status bar's plugin cells). The body is checked when it opens and again once it has
 * rested after a change; only the checks that read the entry's language are asked, and a site with none asks nothing. `off` is an entry
 * nobody changes (archived, in the trash): there is nothing to fix there.
 */
export function useTextChecks({
	body,
	checks,
	collection,
	locale,
	off,
}: {
	body: Editor | null;
	checks: SchemaRead["textChecks"];
	collection: string;
	locale: string | undefined;
	off: boolean;
}) {
	const { run } = useOperation<{ checks: TextCheckResult[] }>("plugins.checkText");
	const [cells, setCells] = useState<TextCheckCell[]>([]);
	const reads =
		!off &&
		locale !== undefined &&
		(checks ?? []).some((check) => check.locales === null || check.locales.includes(locale));
	// The newest question is the one whose answer counts: an older answer is about a body that has changed since.
	const turn = useRef(0);

	useEffect(() => {
		if (!body || !reads || locale === undefined) {
			setCells([]);
			return;
		}
		let timer: ReturnType<typeof setTimeout> | undefined;
		const ask = async () => {
			turn.current += 1;
			const mine = turn.current;
			const blocks = blockTexts(body.state.doc);
			const texts = new Map(blocks.map((block) => [block.id, block.text]));
			const answer = await run({
				collection,
				locale,
				blocks: blocks.map(({ id, text }) => ({ id, text })),
			});
			if (mine !== turn.current) return;
			// A check that failed, or the call itself, leaves no cell: there is nothing a person could do about it here.
			setCells(
				answer.ok
					? answer.body.checks.map((check) => ({
							plugin: check.plugin,
							label: check.label,
							findings: check.findings.map((found) => ({
								...found,
								was: (texts.get(found.block) ?? "").slice(found.from, found.to),
							})),
						}))
					: [],
			);
		};
		const later = () => {
			clearTimeout(timer);
			timer = setTimeout(() => void ask(), REST_MS);
		};
		void ask();
		body.on("update", later);
		return () => {
			body.off("update", later);
			clearTimeout(timer);
			turn.current += 1;
		};
	}, [body, reads, collection, locale, run]);

	/** Puts findings' words in the body; what went in leaves its cell at once, and the body is checked again once it rests. */
	const fix = useCallback(
		(plugin: string, findings: readonly Found[]) => {
			if (!body || fixInEditor(body, findings) === 0) return;
			setCells((was) =>
				was.map((cell) =>
					cell.plugin === plugin
						? { ...cell, findings: cell.findings.filter((each) => !findings.includes(each)) }
						: cell,
				),
			);
		},
		[body],
	);
	const show = useCallback((found: Found) => (body ? showInEditor(body, found) : false), [body]);

	return { cells, fix, show };
}
