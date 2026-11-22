import { z } from "zod";
import { isOperation } from "./operation";
import type { OperationSpec, ResourceTree } from "./types";

/** 조립한 리소스 트리에 있는 모든 Operation의 명세. `monti.spec()`과 공개 `specOf`가 함께 쓴다. */
export function specsOf(tree: ResourceTree): OperationSpec[] {
	return entriesOf(tree, "");
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
