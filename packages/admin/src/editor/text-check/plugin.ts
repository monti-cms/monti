import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { DocTextIssue } from "./run";

/**
 * 검사 결과를 물결 밑줄(장식)로 그리는 ProseMirror 플러그인. 결과는 문서가 바뀌면 위치를 따라가고,
 * 결과 범위 안(맞닿은 자리 포함)을 고치면 그 결과는 사라진다.
 */

export interface TextCheckPluginState {
	readonly issues: readonly DocTextIssue[];
	readonly decorations: DecorationSet;
}

export type TextCheckMeta =
	/** `checkerIds`의 결과 중 `ranges`에 걸친 것을 `issues`로 바꾼다. */
	| {
			readonly type: "replace";
			readonly checkerIds: readonly string[];
			readonly ranges: readonly { readonly from: number; readonly to: number }[];
			readonly issues: readonly DocTextIssue[];
	  }
	| { readonly type: "remove"; readonly keys: readonly string[] }
	| { readonly type: "clear" };

/** 기본 플러그인 이름표. 검사 확장마다 따로 만들어(`new PluginKey`) 서로 겹치지 않게 한다. */
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

/** 문서 변경을 따라 결과 위치를 옮긴다. 바뀐 범위에 걸치거나 맞닿은 결과는 뺀다. */
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

/** 그 위치를 덮는 결과(가장 짧은 것). */
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
				// 장식(밑줄) 위를 누른 때만 연다. 줄 끝 빈 자리를 눌러 커서가 결과 끝에 붙은 경우는 열지 않는다.
				if (!(event.target instanceof Element) || !event.target.closest("[data-text-issue]")) return false;
				const issue = issueAt(view.state, pos, key);
				if (issue) onIssueClick(issue, view);
				// 커서는 평소대로 옮긴다.
				return false;
			},
		},
	});
}

export const textCheckIssues = (state: EditorState, key = textCheckPluginKey): readonly DocTextIssue[] =>
	key.getState(state)?.issues ?? [];
