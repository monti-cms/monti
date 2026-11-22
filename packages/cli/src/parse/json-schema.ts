/** `OperationSpec.input`(core가 zod로 만든 JSON Schema)에서 CLI가 읽는 부분. */
interface JsonSchema {
	type?: unknown;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	const?: unknown;
	enum?: unknown[];
}

/** 노드와 그 `anyOf`·`oneOf` 가지들. 가지 안의 가지까지 펼친다. */
function branchesOf(node: JsonSchema): JsonSchema[] {
	return [node, ...[...(node.anyOf ?? []), ...(node.oneOf ?? [])].flatMap(branchesOf)];
}

/** 한 입력 모양에서 `name` 속성의 스키마. 그 모양에 없는 속성(물려받은 `__proto__` 등 포함)이면 빈 배열이다. */
function propertyOf(shape: JsonSchema, name: string): JsonSchema[] {
	const properties = shape.properties ?? {};
	return Object.hasOwn(properties, name) ? [properties[name]] : [];
}

/** 노드의 `type`에 적힌 JSON 타입들. `["integer", "null"]`처럼 배열로 적은 것도 읽는다. */
function typesOf(node: JsonSchema): string[] {
	if (Array.isArray(node.type)) return node.type;
	return typeof node.type === "string" ? [node.type] : [];
}

/**
 * 속성 `property`가 값 `value`와 맞는지. 판별 값(`const`·`enum`)이 없는 속성은 어떤 값과도 맞고, 있으면 그 가운데 같은 값이
 * 있어야 한다. 명령줄 옵션의 값은 글자로 오므로 글로 바꿔 견준다.
 */
function matches(property: JsonSchema, value: unknown): boolean {
	const allowed = property.enum ?? (Object.hasOwn(property, "const") ? [property.const] : undefined);
	return allowed === undefined || allowed.some((option) => String(option) === String(value));
}

/**
 * `given`이 고른 입력 모양: `given`의 속성을 모두 받고 판별 값까지 맞는 첫 모양. 입력이 여러 모양(`anyOf`·`oneOf`) 중
 * 하나이면 가지들 가운데서 고른다. 그런 모양이 없으면 `undefined`다.
 */
function chosenShape(schema: JsonSchema, given: Record<string, unknown>): JsonSchema | undefined {
	return branchesOf(schema).find((shape) =>
		Object.entries(given).every(([name, value]) =>
			propertyOf(shape, name).some((property) => matches(property, value)),
		),
	);
}

/** 작업 입력이 받는 속성 이름. 입력이 여러 모양(`anyOf`) 중 하나이면 모든 모양의 속성을 처음 나온 순서대로 한 번씩 모은다. */
export function propertyNames(input: Record<string, unknown>): string[] {
	const shapes = branchesOf(input as JsonSchema);
	return [...new Set(shapes.flatMap((shape) => Object.keys(shape.properties ?? {})))];
}

/** 작업 입력에서 `given`이 고른 모양의 필수 속성 이름. 고른 모양이 없으면 입력 자체의 필수 속성이다. */
export function requiredProperties(input: Record<string, unknown>, given: Record<string, unknown>): string[] {
	const schema = input as JsonSchema;
	return (chosenShape(schema, given) ?? schema).required ?? [];
}

/**
 * 작업 입력의 `name` 속성이 받는 JSON 타입(`string`, `integer`, `null` 등). `given`(명령줄 옵션)이 고른 모양이 있으면 그
 * 모양에서, `given`이 없거나 고른 모양이 없으면 모든 모양에서 모은다.
 */
export function propertyTypes(
	input: Record<string, unknown>,
	name: string,
	given?: Record<string, unknown>,
): Set<string> {
	const schema = input as JsonSchema;
	const chosen = given === undefined ? undefined : chosenShape(schema, given);
	const nodes = (chosen === undefined ? branchesOf(schema) : [chosen]).flatMap((shape) => propertyOf(shape, name));
	return new Set(nodes.flatMap(branchesOf).flatMap(typesOf));
}
