/** `OperationSpec.input`(core가 zod로 만든 JSON Schema)에서 CLI가 읽는 부분. */
interface JsonSchema {
	type?: unknown;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
}

/** 노드와 그 `anyOf`·`oneOf` 가지들. 가지 안의 가지까지 펼친다. */
function branchesOf(node: JsonSchema): JsonSchema[] {
	return [node, ...[...(node.anyOf ?? []), ...(node.oneOf ?? [])].flatMap(branchesOf)];
}

/** 한 입력 모양에서 `name` 속성의 스키마. 그 모양에 없는 속성이면 빈 배열이다. */
function propertyOf(shape: JsonSchema, name: string): JsonSchema[] {
	const properties = shape.properties ?? {};
	return Object.hasOwn(properties, name) ? [properties[name]] : [];
}

/** 작업 입력이 받는 속성 이름. 입력이 여러 모양(`anyOf`) 중 하나이면 모든 모양의 속성을 처음 나온 순서대로 한 번씩 모은다. */
export function propertyNames(input: Record<string, unknown>): string[] {
	const shapes = branchesOf(input as JsonSchema);
	return [...new Set(shapes.flatMap((shape) => Object.keys(shape.properties ?? {})))];
}

/**
 * 작업 입력에서 `given`이 고른 모양의 필수 속성 이름. 입력이 여러 모양(`anyOf`) 중 하나이면 `given`의 속성을 모두 받는 첫
 * 모양을 고르고, 그런 모양이 없거나 입력이 한 모양뿐이면 입력 자체의 필수 속성이다.
 */
export function requiredProperties(input: Record<string, unknown>, given: Record<string, unknown>): string[] {
	const schema = input as JsonSchema;
	const names = Object.keys(given);
	const shape = schema.anyOf?.find((branch) => names.every((name) => propertyOf(branch, name).length > 0)) ?? schema;
	return shape.required ?? [];
}

/** 작업 입력의 `name` 속성이 받는 JSON 타입(`string`, `integer`, `null` 등). 여러 모양에 같은 이름이 있으면 모두 모은다. */
export function propertyTypes(input: Record<string, unknown>, name: string): Set<string> {
	const nodes = branchesOf(input as JsonSchema).flatMap((shape) => propertyOf(shape, name));
	return new Set(nodes.flatMap(branchesOf).flatMap((node) => (typeof node.type === "string" ? [node.type] : [])));
}
