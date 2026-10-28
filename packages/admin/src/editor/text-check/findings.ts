import type { Node as PmNode } from "@tiptap/pm/model";
import { extractSegments, PLACEHOLDER } from "./extract";
import type { DocTextIssue } from "./run";
import type { TextCheckController } from "./use-text-check";

/** One finding of a text checker, as the status bar's plugin cell lists it. */
export interface TextIssueItem {
	readonly key: string;
	/** The marked text. */
	readonly text: string;
	/** The first replacement the checker suggests, if any. */
	readonly suggestion: string | null;
	/** Which text block of the body it is in, counting from 1 (blocks without letters are not counted). */
	readonly paragraph: number;
	/** The text block it is in, as one line. */
	readonly context: string;
	/** Selects the finding in the body. */
	readonly jump: () => void;
	/** Replaces the marked text with the suggestion; `null` when there is none. */
	readonly fix: (() => void) | null;
}

/** What the text checkers found in the body, for the status bar. */
export interface TextIssues {
	readonly count: number;
	/** The findings in document order. */
	readonly items: readonly TextIssueItem[];
	/** Replaces every finding that has a suggestion with it; `null` when none has one. */
	readonly fixAll: (() => void) | null;
}

/** For each finding, the number and the text of the text block it is in. */
export function placesOf(
	doc: PmNode,
	issues: readonly Pick<DocTextIssue, "from">[],
	locale: string,
): { paragraph: number; context: string }[] {
	const segments = extractSegments(doc, { locale });
	return issues.map((issue) => {
		const index = segments.findIndex((segment) => issue.from >= segment.from && issue.from <= segment.to);
		const segment = segments[index];
		return {
			paragraph: index < 0 ? 0 : index + 1,
			context: (segment?.text ?? "").replaceAll(PLACEHOLDER, " ").replace(/\s+/g, " ").trim(),
		};
	});
}

/**
 * The replacements that fix findings in one go: each finding with a suggestion, last in the document first, so an earlier replacement does not move
 * the later ones. A finding that overlaps one that comes after it is left out.
 */
export function fixAllReplacements(
	issues: readonly Pick<DocTextIssue, "from" | "to" | "suggestions">[],
): { from: number; to: number; text: string }[] {
	const replacements: { from: number; to: number; text: string }[] = [];
	let limit = Number.POSITIVE_INFINITY;
	for (const issue of [...issues].sort((a, b) => b.from - a.from)) {
		const text = issue.suggestions[0];
		if (text === undefined || issue.to > limit) continue;
		replacements.push({ from: issue.from, to: issue.to, text });
		limit = issue.from;
	}
	return replacements;
}

/** What the status bar's plugin cell is given: the controller's results, each with its place, and the ways to fix them. */
export function textIssuesOf(controller: TextCheckController, locale: string): TextIssues {
	const { issues, editor } = controller;
	const places = placesOf(editor.state.doc, issues, locale);
	return {
		count: issues.length,
		items: issues.map((issue, index) => {
			const suggestion = issue.suggestions[0] ?? null;
			return {
				key: issue.key,
				text: issue.text,
				suggestion,
				paragraph: places[index]?.paragraph ?? 0,
				context: places[index]?.context ?? "",
				jump: () => controller.jump(issue),
				fix: suggestion === null ? null : () => controller.apply(issue, suggestion),
			};
		}),
		fixAll: issues.some((issue) => issue.suggestions.length > 0) ? controller.applyAll : null,
	};
}
