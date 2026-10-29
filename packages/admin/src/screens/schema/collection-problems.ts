import type { DraftProblem } from "./draft-problems";
import {
	collectionsOf,
	type FieldPlace,
	type FieldProblem,
	fieldProblems,
	fieldsOf,
	isObj,
	type Obj,
} from "./schema-model";

/** The problem of a slug field that has no source: core lets such a slug stand alone (the form asks for the source when a field is added), so a saved file with one is fine. */
const isFormOnly = (field: Obj, problem: FieldProblem): boolean =>
	problem === "slugFrom" && field.kind === "slug" && typeof field.from !== "string";

/**
 * The problems of the collections of the draft: a select without options, a relation without a target, a slug made from a field that is not there, and the like,
 * for every field and every field inside a conditional field. These are core's own rules for a field (`fieldProblems`), so a draft with one would be refused by
 * the server. `codeCollections` are the collections defined in code, which a relation may point to besides the ones in the file.
 */
export function collectionProblems(file: Obj, codeCollections: readonly string[] = []): DraftProblem[] {
	const collections = collectionsOf(file);
	const names = [...Object.keys(collections), ...codeCollections];
	const problems: DraftProblem[] = [];
	for (const [collectionName, collection] of Object.entries(collections)) {
		const check = (field: Obj, name: string, path: string) => {
			for (const code of fieldProblems(field, collection, names)) {
				if (!isFormOnly(field, code))
					problems.push({ area: "collections", collection: collectionName, field: name, path, code });
			}
		};
		for (const [name, field] of Object.entries(fieldsOf(collection))) {
			const path = `collections.${collectionName}.fields.${name}`;
			check(field, name, path);
			if (field.kind !== "conditional" || !isObj(field.values)) continue;
			for (const [option, branch] of Object.entries(field.values)) {
				if (!isObj(branch)) continue;
				for (const [inner, innerField] of Object.entries(branch)) {
					if (isObj(innerField)) check(innerField, inner, `${path}.values.${option}.${inner}`);
				}
			}
		}
	}
	return problems;
}

/** Where the field of a problem lives, to open its sheet: at the top of the collection, or in a branch of a conditional field (read from the path the problem has). */
export function placeOfProblem(problem: DraftProblem): { place: FieldPlace; name: string } | null {
	if (problem.field === undefined) return null;
	const branch = /\.fields\.([^.]+)\.values\.([^.]+)\.[^.]+$/.exec(problem.path);
	if (branch?.[1] && branch[2])
		return { place: { branch: { field: branch[1], option: branch[2] } }, name: problem.field };
	return /\.fields\.[^.]+$/.test(problem.path) ? { place: {}, name: problem.field } : null;
}
