import type { Site } from "@monti-cms/core/site";
import type { CmsIssue } from "../../api/error-message";
import type { TranslatorFor } from "../../translator";
import { issueHasPlace, readinessText } from "./publish-readiness";
import type { publishReadinessMessages } from "./publish-readiness.messages";

/** One thing to fix before publishing, as a row of the to-do list. */
export interface TodoRow {
	readonly id: string;
	readonly title: string;
	/** Where it is. */
	readonly detail: string | undefined;
	/** Goes to the place of the problem; only a problem that has a place can be gone to. */
	readonly onOpen: (() => void) | undefined;
}

/** The problems the publish check found, as rows: what to do in plain words, where it is, and the way to the place. */
export function todoRows(
	t: TranslatorFor<typeof publishReadinessMessages>,
	issues: readonly CmsIssue[],
	focus: (issue: CmsIssue) => void,
): TodoRow[] {
	return issues.map((issue) => ({
		id: JSON.stringify(issue),
		title: readinessText(t, issue),
		detail: issue.where,
		onOpen: issueHasPlace(issue) ? () => focus(issue) : undefined,
	}));
}

/**
 * The labels of the required fields that are right. The server keys every required-value problem by the field's name (`path`), so a field with no
 * problem is exactly one that is filled.
 */
export function doneLabels(
	required: readonly { readonly name: string; readonly label: string }[],
	issues: readonly CmsIssue[],
): string[] {
	const broken = new Set(issues.flatMap((issue) => (issue.path ? [issue.path] : [])));
	return required.filter((field) => !broken.has(field.name)).map((field) => field.label);
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
