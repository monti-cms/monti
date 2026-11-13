import type { TextCheckResult } from "@monti-cms/core";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { blockTexts, type Found, fixInEditor, showInEditor, stands } from "../../editor/text-check";
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
		// The words each block had when it was last checked: only a block that changed since is sent again, and what was found in the
		// others stands. A long body is not handed whole to the plugin's service after every pause.
		const checked = new Map<string, string>();
		const ask = async () => {
			turn.current += 1;
			const mine = turn.current;
			const blocks = blockTexts(body.state.doc);
			const texts = new Map(blocks.map((block) => [block.id, block.text]));
			const changed = blocks.filter((block) => checked.get(block.id) !== block.text);
			/** What was found before, in the blocks that are still there as they were. */
			const kept = (cells: TextCheckCell[], again: ReadonlySet<string>) =>
				cells.map((cell) => ({
					...cell,
					findings: cell.findings.filter((found) => texts.has(found.block) && !again.has(found.block)),
				}));
			if (changed.length === 0)
				return setCells((was) => kept(was, new Set()).filter((cell) => cell.findings.length > 0));
			const answer = await run({
				collection,
				locale,
				blocks: changed.map(({ id, text }) => ({ id, text })),
			});
			if (mine !== turn.current) return;
			// A check that failed, or the call itself, says nothing new: what stood stands, and the blocks are asked about again next time.
			if (!answer.ok) return;
			for (const id of [...checked.keys()]) if (!texts.has(id)) checked.delete(id);
			const again = new Set(changed.map((block) => block.id));
			// Checked, unless a plugin's check failed: then the same blocks are asked about again after the next change.
			if (answer.body.checks.every((check) => !check.failed))
				for (const block of changed) checked.set(block.id, block.text);
			const place = new Map(blocks.map((block, index) => [block.id, index]));
			setCells((was) => {
				const before = kept(was, again);
				return answer.body.checks
					.map((check) => ({
						plugin: check.plugin,
						label: check.label,
						findings: [
							...(before.find((cell) => cell.plugin === check.plugin)?.findings ?? []),
							...check.findings
								.map((found) => ({ ...found, was: (texts.get(found.block) ?? "").slice(found.from, found.to) }))
								// What cannot be put in (it reaches over a line break or a footnote's mark) is no row: its "fix" would do nothing.
								.filter((found) => stands(body.state.doc, found)),
							// In the body's order, as a person reads it.
						].sort((a, b) => (place.get(a.block) ?? 0) - (place.get(b.block) ?? 0) || a.from - b.from),
					}))
					.filter((cell) => cell.findings.length > 0);
			});
		};
		const later = () => {
			// The body changed: an answer still on its way is about the body as it was, and must not bring back a row just fixed.
			turn.current += 1;
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
