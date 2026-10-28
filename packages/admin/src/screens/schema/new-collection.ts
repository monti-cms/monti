import { collectionNameProblem, defaultPath, idFromName, pathProblem } from "./schema-model";

export type NewCollectionKind = "document" | "item";

/** What the writer has typed into the new-collection sheet; `null` means "not typed yet", so the value follows the one before it. */
export interface NewCollectionInput {
	name: string;
	typedId: string | null;
	kind: NewCollectionKind;
	typedPath: string | null;
	/** The identifiers already in the file (including collections taken out of the list and not saved yet). */
	taken: readonly string[];
}

export interface NewCollectionForm {
	id: string;
	path: string;
	/** What is wrong with the identifier, as the key of `name.*`: shown as the one error line. `null` while it is fine or not typed yet. */
	idIssue: "empty" | "pattern" | "reserved" | "taken" | "idEmpty" | null;
	pathIssue: "slash" | "slug" | null;
	/** The collection can be created. */
	ready: boolean;
}

/**
 * The values of the new-collection sheet from what has been typed. The identifier follows the name (a name without ASCII letters, such as a Korean one,
 * leaves it empty until the writer types one) and the address follows the identifier, each until the writer types one of their own. An item has no
 * public page, so its address starts empty. The identifier is not called wrong before the writer has had the chance to type it.
 */
export function newCollectionForm({ name, typedId, kind, typedPath, taken }: NewCollectionInput): NewCollectionForm {
	const id = typedId ?? idFromName(name);
	const path = typedPath ?? (kind === "document" ? defaultPath(id) : "");
	const idIssue = id === "" ? (typedId !== null ? "idEmpty" : null) : collectionNameProblem(id, taken);
	const pathIssue = pathProblem(path);
	return {
		id,
		path,
		idIssue,
		pathIssue,
		ready: name.trim() !== "" && id !== "" && idIssue === null && pathIssue === null,
	};
}
