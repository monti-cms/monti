import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { DocTextIssue } from "./run";

/**
 * ProseMirror plugin that draws check results as wavy underlines (decorations). Results follow their positions as the document changes,
 * and editing inside a result range (including touching edges) removes that result.
 */

export interface TextCheckPluginState {
	readonly issues: readonly DocTextIssue[];
	readonly decorations: DecorationSet;
}

export type TextCheckMeta =
	/** Replaces the results of `checkerIds` that span `ranges` with `issues`. */
	| {
			readonly type: "replace";
			readonly checkerIds: readonly string[];
			readonly ranges: readonly { readonly from: number; readonly to: number }[];
			readonly issues: readonly DocTextIssue[];
	  }
	| { readonly type: "remove"; readonly keys: readonly string[] }
	| { readonly type: "clear" };

/** Default plugin name tag. Created separately per check extension (`new PluginKey`) so they do not collide. */
export const textCheckPluginKey = new PluginKey<TextCheckPluginState>("cmsTextCheck");

const EMPTY: TextCheckPluginState = { issues: [], decorations: DecorationSet.empty };

function decorate(doc: EditorState["doc"], issues: readonly DocTextIssue[]): DecorationSet {
	if (issues.length === 0) return DecorationSet.empty;
	return DecorationSet.create(
		doc,
		issues.map((issue) =>
			Decoration.inline(
				issue.from,
				issue.to,
				{ class: "cms-text-issue", "data-severity": issue.severity, "data-text-issue": issue.key },
				{ key: issue.key },
			),
		),
	);
}

/** Moves result positions along with document changes. Results that overlap or touch the changed range are dropped. */
export function mapIssues(issues: readonly DocTextIssue[], tr: Transaction): readonly DocTextIssue[] {
	let current = issues;
	for (const map of tr.mapping.maps) {
		const changed: [number, number][] = [];
		map.forEach((oldStart, oldEnd) => {
			changed.push([oldStart, oldEnd]);
		});
		if (changed.length === 0) continue;
		current = current.flatMap((issue) => {
			if (changed.some(([start, end]) => start <= issue.to && end >= issue.from)) return [];
			const from = map.map(issue.from, 1);
			const to = map.map(issue.to, -1);
			return from < to ? [{ ...issue, from, to }] : [];
		});
	}
	return current;
}

const overlaps = (issue: DocTextIssue, range: { from: number; to: number }) =>
	issue.from < range.to && issue.to > range.from;

function applyMeta(issues: readonly DocTextIssue[], meta: TextCheckMeta): readonly DocTextIssue[] {
	if (meta.type === "clear") return [];
	if (meta.type === "remove") {
		const keys = new Set(meta.keys);
		return issues.filter((issue) => !keys.has(issue.key));
	}
	const kept = issues.filter(
		(issue) => !meta.checkerIds.includes(issue.checkerId) || !meta.ranges.some((range) => overlaps(issue, range)),
	);
	return [...kept, ...meta.issues].sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The result covering that position (the shortest one). */
export function issueAt(state: EditorState, pos: number, key = textCheckPluginKey): DocTextIssue | null {
	const issues = key.getState(state)?.issues ?? [];
	let found: DocTextIssue | null = null;
	for (const issue of issues) {
		if (issue.from <= pos && pos <= issue.to && (!found || issue.to - issue.from < found.to - found.from))
			found = issue;
	}
	return found;
}

export function createTextCheckPlugin({
	key = textCheckPluginKey,
	onIssueClick,
}: {
	key?: PluginKey<TextCheckPluginState>;
	onIssueClick?: (issue: DocTextIssue, view: EditorView) => void;
} = {}): Plugin<TextCheckPluginState> {
	return new Plugin<TextCheckPluginState>({
		key,
		state: {
			init: () => EMPTY,
			apply(tr, value, _old, state) {
				const meta = tr.getMeta(key) as TextCheckMeta | undefined;
				if (!tr.docChanged && !meta) return value;
				let issues = tr.docChanged ? mapIssues(value.issues, tr) : value.issues;
				if (meta) issues = applyMeta(issues, meta);
				if (issues === value.issues) return value;
				return { issues, decorations: decorate(state.doc, issues) };
			},
		},
		props: {
			decorations: (state) => key.getState(state)?.decorations ?? DecorationSet.empty,
			handleClick(view, pos, event) {
				if (!onIssueClick || event.button !== 0) return false;
				// Open only when pressing on a decoration (underline). Pressing the empty space at the end of a line, which puts the cursor right after a result, does not open it.
				if (!(event.target instanceof Element) || !event.target.closest("[data-text-issue]")) return false;
				const issue = issueAt(view.state, pos, key);
				if (issue) onIssueClick(issue, view);
				// Move the cursor as usual.
				return false;
			},
		},
	});
}

export const textCheckIssues = (state: EditorState, key = textCheckPluginKey): readonly DocTextIssue[] =>
	key.getState(state)?.issues ?? [];
