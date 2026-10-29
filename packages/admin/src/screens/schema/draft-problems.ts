import { collectionProblems } from "./collection-problems";
import type { Obj } from "./schema-model";
import { siteProblems } from "./site-problems";

/** Something in the draft that stops it from being saved: where it is (`path`, as in the schema file) and what is wrong (`code`, the key of the line that says it). */
export interface DraftProblem {
	/** The Settings tab it is on. */
	readonly area: "collections" | "locales" | "site" | "admin";
	/** The place in the file, like `site.aliases.0` or `collections.post.fields.format`. */
	readonly path: string;
	readonly code: string;
	readonly collection?: string;
	readonly field?: string;
}

/**
 * Every problem of the draft. The title row's save button stays off while there is one; the editors show each as one line under the field it belongs to, and
 * the preview of a collection's fields shows its problems instead of the preview.
 */
export function draftProblems(file: Obj, codeCollections: readonly string[] = []): DraftProblem[] {
	return [...siteProblems(file), ...collectionProblems(file, codeCollections)];
}
