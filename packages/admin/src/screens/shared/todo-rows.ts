import type { StoredDocument } from "@monti-cms/core/document";
import type { Site } from "@monti-cms/core/site";
import type { CmsIssue } from "../../api/error-message";
import type { TranslatorFor } from "../../translator";
import { issueHasPlace, readinessText } from "./publish-readiness";
import type { publishReadinessMessages } from "./publish-readiness.messages";

type Translator = TranslatorFor<typeof publishReadinessMessages>;

/** One thing to fix before publishing, as a row of the to-do list: problems of the same kind are one row. */
export interface TodoRow {
	/** Stays the same while the row is about the same kind of problem, so the list and the memory of fixed ones can follow it. */
	readonly key: string;
	readonly title: string;
	/** Where it is. */
	readonly detail: string | undefined;
	/** How the row reads once it is fixed, under a check; `undefined` for a problem that has no name to keep. */
	readonly doneLabel: string | undefined;
	/** Goes to the first place of the problem; only a problem that has a place can be gone to. */
	readonly onOpen: (() => void) | undefined;
}

/** What the rows need to know of the entry to be worded: the label of a field, whether it is picked, and the number of an image in the body. */
export interface TodoContext {
	readonly fieldLabel: (path: string) => string | undefined;
	/** Whether the field is chosen from something (a picture, a relation, an option) instead of written. */
	readonly picks: (path: string) => boolean;
	readonly imageNumber: (blockId: string) => number | undefined;
}

export interface TodoGroup {
	readonly key: string;
	readonly kind: "image-alt" | "field" | "issue";
	readonly issues: readonly CmsIssue[];
}

/**
 * Gathers the problems the publish check found into the rows a person reads: the images without alt text are one row, every other problem stays its own,
 * in the order the server gave them (a group sits where its first problem was).
 */
export function groupIssues(issues: readonly CmsIssue[]): TodoGroup[] {
	const groups: { key: string; kind: TodoGroup["kind"]; issues: CmsIssue[] }[] = [];
	for (const [index, issue] of issues.entries()) {
		if (issue.code === "missing_image_alt") {
			const found = groups.find((group) => group.kind === "image-alt");
			if (found) found.issues.push(issue);
			else groups.push({ key: "image-alt", kind: "image-alt", issues: [issue] });
		} else if (issue.code === "missing_field" && issue.path) {
			groups.push({ key: `field:${issue.path}`, kind: "field", issues: [issue] });
		} else
			groups.push({ key: `issue:${issue.code ?? ""}:${issue.path ?? ""}:${index}`, kind: "issue", issues: [issue] });
	}
	return groups;
}

/** How many rows the problems make: the number the status bar and the refused-publish toast give. */
export const todoCount = (issues: readonly CmsIssue[]): number => groupIssues(issues).length;

/** The problems the publish check found, as rows: what to do in plain words, where it is, and the way to the place. */
export function todoRows(
	t: Translator,
	issues: readonly CmsIssue[],
	focus: (issue: CmsIssue) => void,
	context: TodoContext,
): TodoRow[] {
	return groupIssues(issues).map((group) => {
		const first = group.issues[0] as CmsIssue;
		const onOpen = group.issues.some(issueHasPlace)
			? () => focus((group.issues.find(issueHasPlace) as CmsIssue) ?? first)
			: undefined;
		if (group.kind === "image-alt") {
			const places = group.issues.map((issue) => {
				const number = issue.position?.blockId ? context.imageNumber(issue.position.blockId) : undefined;
				return number === undefined ? t("place.bodyAny") : t("place.body", { number });
			});
			return {
				key: group.key,
				title: t("group.missing_image_alt", { count: group.issues.length }),
				detail: places.join(" · "),
				doneLabel: t("done.imageAlt", { count: group.issues.length }),
				onOpen,
			};
		}
		const label = group.kind === "field" && first.path ? context.fieldLabel(first.path) : undefined;
		if (label) {
			return {
				key: group.key,
				title: t(context.picks(first.path as string) ? "field.pick" : "field.write", { name: label }),
				detail: t("field.empty", { name: label }),
				doneLabel: label,
				onOpen,
			};
		}
		return { key: group.key, title: readinessText(t, first), detail: first.where, doneLabel: undefined, onOpen };
	});
}

/** A to-do that was fixed while the entry was open, kept to be shown under a check. */
export interface ResolvedTodo {
	readonly key: string;
	readonly label: string;
}

/**
 * The to-dos fixed so far: the earlier ones, plus the rows that were in the last list and are not in this one; a row that comes back is no longer
 * fixed. Only a row with a name (`doneLabel`) is kept.
 */
export function trackResolved(
	resolved: readonly ResolvedTodo[],
	before: readonly TodoRow[],
	after: readonly TodoRow[],
): ResolvedTodo[] {
	const now = new Set(after.map((row) => row.key));
	const gone = before.flatMap((row) =>
		!now.has(row.key) && row.doneLabel !== undefined ? [{ key: row.key, label: row.doneLabel }] : [],
	);
	const kept = resolved.filter((item) => !now.has(item.key) && !gone.some((other) => other.key === item.key));
	return [...kept, ...gone];
}

/** The number of each image of the body (1 for the first in reading order), found by the block id the check names. */
export function imageNumbers(doc: Pick<StoredDocument, "content">): (blockId: string) => number | undefined {
	const ids: string[] = [];
	const walk = (nodes: readonly { type: string; id?: string; content?: readonly unknown[] }[]) => {
		for (const node of nodes) {
			if (node.type === "image" && node.id) ids.push(node.id);
			if (node.content) walk(node.content as typeof nodes);
		}
	};
	walk(doc.content as never);
	return (blockId) => {
		const index = ids.indexOf(blockId);
		return index === -1 ? undefined : index + 1;
	};
}

/**
 * The labels of the required fields that are right. The server keys every required-value problem by the field's name (`path`), so a field with no
 * problem is exactly one that is filled. `except` are labels that have a row of their own (fixed just now).
 */
export function doneLabels(
	required: readonly { readonly name: string; readonly label: string }[],
	issues: readonly CmsIssue[],
	except: readonly string[] = [],
): string[] {
	const broken = new Set(issues.flatMap((issue) => (issue.path ? [issue.path] : [])));
	return required
		.filter((field) => !broken.has(field.name) && !except.includes(field.label))
		.map((field) => field.label);
}

/**
 * The fields the publish check requires of the saved draft right now, in the order of the form: the title, the fields marked `required`, and the
 * fields of a conditional group only while its condition holds in `metadata`. It is the list the server's check is made from, so a field left
 * out here is one the check does not ask for.
 */
export function requiredFields(
	site: Pick<Site, "isCollection" | "requiredFieldsOf">,
	collection: string,
	translation: boolean,
	metadata: { readonly [key: string]: unknown },
): { name: string; label: string }[] {
	if (!site.isCollection(collection)) return [];
	return site
		.requiredFieldsOf(collection, metadata, { localizedOnly: translation })
		.sort((a, b) => a.order - b.order)
		.map(({ name, label }) => ({ name, label: label ?? name }));
}
