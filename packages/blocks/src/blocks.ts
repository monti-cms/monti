import { callout } from "./callout";
import { chart } from "./chart";
import { codeRef } from "./code-ref";
import { collapsible } from "./collapsible";
import { type ColorOptions, color } from "./color";
import { columns } from "./columns";
import { mermaid } from "./mermaid";
import { tabs } from "./tabs";
import { tooltip } from "./tooltip";

/**
 * 블록 확장 만들기 함수(이름 → 함수). `blocks()`가 이 순서로 넣는다. 글자 꾸밈(툴팁·코드 연결·글자색)의 순서는 겹친 꾸밈을
 * 저장하는 순서(바깥부터)다.
 */
const FACTORIES = { callout, collapsible, tabs, columns, mermaid, chart, tooltip, codeRef, color } as const;

/** `blocks()`가 넣는 블록 확장 이름. */
export type BlockExtensionName = keyof typeof FACTORIES;

/** 블록 확장 이름 → 그 확장의 옵션. 옵션이 없는 확장은 `true`만 받는다. */
interface BlockExtensionOptions {
	readonly callout: true;
	readonly collapsible: true;
	readonly tabs: true;
	readonly columns: true;
	readonly mermaid: true;
	readonly chart: true;
	readonly tooltip: true;
	readonly codeRef: true;
	readonly color: ColorOptions;
}

export type BlocksOptions = {
	/** 넣을 확장(없으면 전부). */
	readonly only?: readonly BlockExtensionName[];
	/** 뺄 확장. */
	readonly omit?: readonly BlockExtensionName[];
} & {
	/** 확장별 옵션(예: `color: { palette }`). `false`면 그 확장을 뺀다. */
	readonly [K in BlockExtensionName]?: BlockExtensionOptions[K] | false;
};

type BlockPlugin = ReturnType<(typeof FACTORIES)[BlockExtensionName]>;

/**
 * 이 패키지의 블록 확장을 한 번에 넣는다. 사이트 설정의 `plugins`에 펼쳐 넣는다.
 *
 * ```ts
 * plugins: [...blocks()]                                  // 전부
 * plugins: [...blocks({ omit: ["chart"] })]               // 차트만 빼고
 * plugins: [...blocks({ only: ["callout", "tooltip"] })]  // 고른 것만
 * plugins: [...blocks({ color: { palette } })]            // 확장별 옵션
 * ```
 *
 * 하나씩 만드는 함수(`callout()`·`color({ palette })` …)도 그대로 쓸 수 있다. 같은 확장을 두 번 넣으면 설정 오류다.
 */
export function blocks(options: BlocksOptions = {}): BlockPlugin[] {
	const names = Object.keys(FACTORIES) as BlockExtensionName[];
	for (const name of [...(options.only ?? []), ...(options.omit ?? [])]) {
		if (!names.includes(name)) throw new Error(`@monti-cms/blocks: unknown block extension "${name}"`);
	}
	return names
		.filter((name) => !options.only || options.only.includes(name))
		.filter((name) => !options.omit?.includes(name) && options[name] !== false)
		.map((name) => (name === "color" ? color(options.color || {}) : FACTORIES[name]()));
}
