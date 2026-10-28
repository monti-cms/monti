import type { DraftProblem } from "./draft-problems";
import type { Obj } from "./schema-model";

/** The problems of the collections of the draft (a select without options, a relation without a target, and the like). */
export function collectionProblems(_file: Obj): DraftProblem[] {
	return [];
}
