import { ADDED_BLOCKS, BLOCKS } from "./active";
import type { BlockDefinition } from "./define";
import { textAlign } from "./definitions";

/**
 * 사이트가 쓰는 블록 정의에서 저장 문법 표·검증 규칙·상수를 만든다(v2 B3). 서버·에디터·공개 렌더러가 함께 쓴다.
 */

export const BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition> = new Map(BLOCKS.map((block) => [block.name, block]));

/** 공개 렌더러 이름(JSX 이름) → 블록 정의. */
export const BLOCK_BY_COMPONENT: ReadonlyMap<string, BlockDefinition> = new Map(
	BLOCKS.map((block) => [block.component, block]),
);

/** 지시자 문법 블록(`:::`·`::`·`:`). 코드 펜스·수식은 Markdown 문법이라 지시자 표에 없다. */
export const directiveBlocks = (): BlockDefinition[] =>
	BLOCKS.filter(
		(block) => block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text",
	);

/** 더한 코드 펜스 블록. 펜스 언어 → 블록 정의. */
export const FENCE_BLOCKS: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_BLOCKS.flatMap((block) => (block.syntax.kind === "fence" ? [[block.syntax.lang, block] as const] : [])),
);

/** 코드 펜스 언어에 맞는 더한 블록. 대소문자를 가리지 않는다. */
export const fenceBlockOf = (lang: unknown): BlockDefinition | undefined =>
	typeof lang === "string" ? FENCE_BLOCKS.get(lang.toLowerCase()) : undefined;

/** 선택 값이 정해진 속성을 벗어나면 그 속성 이름. 발행 전 검사가 `invalid_block_attribute`로 알린다. */
export function invalidOptionAttributes(
	block: BlockDefinition,
	attributes: Readonly<Record<string, unknown>>,
): string[] {
	const invalid: string[] = [];
	for (const [name, attribute] of Object.entries(block.attributes)) {
		const value = attributes[name];
		if (!attribute.options || typeof value !== "string" || value === "") continue;
		if (!Object.hasOwn(attribute.options, value)) invalid.push(name);
	}
	return invalid;
}

/** 자식 블록 규칙(이름·개수)이 있는 블록과 그 자식의 렌더러 이름. 저장 검사가 개수를 센다. */
export const childRules = (): { block: BlockDefinition; childComponents: string[] }[] =>
	ADDED_BLOCKS.flatMap((block) => {
		const names = block.children?.blocks ?? [];
		if (names.length === 0) return [];
		const childComponents = names.flatMap((name) => BLOCK_BY_NAME.get(name)?.component ?? []);
		return [{ block, childComponents }];
	});

const optionValues = (block: BlockDefinition, attribute: string): readonly string[] =>
	Object.keys(block.attributes[attribute]?.options ?? {});

/** §4.4가 허용하는 정렬 값. `justify`는 쓰지 않는다(A4). */
export const TEXT_ALIGN_VALUES = optionValues(textAlign, "align") as readonly ("left" | "center" | "right")[];
