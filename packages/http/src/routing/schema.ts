/** `monti.spec()`이 주는 Operation 입력의 JSON Schema(또는 그 일부). */
type JsonSchema = Record<string, unknown>;

/** 스키마의 분기들: union(`anyOf`·`oneOf`)이면 각 분기, 아니면 스키마 자신 하나. */
function branchesOf(schema: JsonSchema): JsonSchema[] {
	if (Array.isArray(schema.anyOf)) return schema.anyOf;
	if (Array.isArray(schema.oneOf)) return schema.oneOf;
	return [schema];
}

/** 스키마의 `properties`. 없으면(`null` 분기 등) 빈 객체다. */
function propertiesOf(schema: JsonSchema): JsonSchema {
	return Object(schema.properties);
}

/** 입력에 `id` 속성을 받는 분기가 하나 이상 있는지: `/<resource>/:id` 경로를 연다. */
export function hasIdBranch(schema: JsonSchema): boolean {
	return branchesOf(schema).some((branch) => Object.hasOwn(propertiesOf(branch), "id"));
}

/** 입력에 `id`가 필수가 아닌 분기가 하나 이상 있는지: 단일 리소스나 다건 입력으로 `/<resource>` 경로를 연다. */
export function hasNoIdBranch(schema: JsonSchema): boolean {
	return branchesOf(schema).some((branch) => !(Array.isArray(branch.required) && branch.required.includes("id")));
}

/**
 * 점 표기 경로 `path`(`["relation", "field"]`)에 있는 속성이 받는 JSON Schema `type`들. 입력과 속성의 union 분기, 배열로
 * 쓴 `type`(`["string", "null"]`)을 모두 펼쳐 모은다. 그런 속성이 없으면 `undefined`만 든다.
 */
export function typesAt(schema: JsonSchema, path: string[]): Set<unknown> {
	let nodes = branchesOf(schema);
	for (const key of path) {
		nodes = nodes.flatMap((node) => branchesOf(Object(propertiesOf(node)[key])));
	}
	return new Set(nodes.flatMap((node) => [node.type].flat()));
}
