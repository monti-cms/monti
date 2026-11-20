import { z } from "zod";
import { isOperation } from "./operation";
import type { OperationSpec, ResourceTree } from "./types";

/** `monti.spec()` over the assembled resource tree. */
export function specOf(tree: ResourceTree): () => OperationSpec[] {
	return function spec() {
		return entriesOf(tree, "");
	};
}

/**
 * Each operation under `prefix` at its key path. The input schema is the input side (`io: "input"`): an object input
 * accepts and drops unknown keys, so it must not say `additionalProperties: false`.
 */
function entriesOf(tree: ResourceTree, prefix: string): OperationSpec[] {
	return Object.entries(tree).flatMap(([key, node]) => {
		const name = prefix === "" ? key : `${prefix}.${key}`;
		if (!isOperation(node)) return entriesOf(node, name);
		return [{ name, kind: node.kind, input: z.toJSONSchema(node.input, { io: "input" }) }];
	});
}
