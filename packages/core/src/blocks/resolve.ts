import type { BlockDefinition } from "./define";
import { BUILTIN_BLOCKS } from "./definitions";

/**
 * 사이트가 쓰는 본문 블록을 정한다. 본체 블록 다음에 플러그인(블록 확장)이 더한 블록, 그다음에 사이트 설정의 `blocks`다.
 *
 * 더하는 블록은 지시자 블록(`container`·`leaf`), 글자 꾸밈(`text` + `editor.view: "mark"`), 코드 펜스 블록(`fence`)이다.
 * 코드 펜스 블록은 그 언어의 코드 펜스를 모두 가져가므로 일반 코드 언어 이름(`ts` 등)을 쓰지 않는다. 글자 꾸밈은 더한 순서가
 * 겹친 꾸밈을 저장하는 순서(바깥부터)다.
 *
 * 쓰던 블록의 확장을 빼면 그 블록은 저장 문법에서 빠져, 이미 쓴 본문을 다시 저장할 때 일반 글로 바뀐다.
 */

/** 블록을 더하는 쪽. 사이트 설정과 그 플러그인이다. */
export interface BlockSources {
	readonly blocks?: readonly BlockDefinition[];
	readonly plugins?: readonly { readonly name: string; readonly blocks?: readonly BlockDefinition[] }[];
}

const NAME = /^[a-z][a-z0-9-]*$/;
const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;

/** 더한 블록(플러그인 순서대로, 그다음 사이트 설정). */
export function addedBlocks(
	sources: BlockSources | undefined,
): { readonly where: string; readonly block: BlockDefinition }[] {
	return [
		...(sources?.plugins ?? []).flatMap((plugin) =>
			(plugin.blocks ?? []).map((block) => ({ where: `plugins.${plugin.name}.blocks.${block.name}`, block })),
		),
		...(sources?.blocks ?? []).map((block) => ({ where: `blocks.${block.name}`, block })),
	];
}

/** 설정에 맞는 블록 목록. 틀린 설정이면 오류를 던진다. */
export function resolveBlocks(sources: BlockSources | undefined): readonly BlockDefinition[] {
	const added = addedBlocks(sources);
	const taken = new Set<string>([
		...BUILTIN_BLOCKS.map((block) => block.name),
		...BUILTIN_BLOCKS.map((block) => block.component),
	]);
	const directives = new Set<string>(
		BUILTIN_BLOCKS.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])),
	);
	const langs = new Set<string>();
	for (const { where, block } of added) {
		const at = `cms.config: ${where}`;
		if (!NAME.test(block.name)) throw new Error(`${at}: name must be lower-case kebab`);
		const { syntax } = block;
		if (syntax.kind === "fence") {
			if (!NAME.test(syntax.lang)) throw new Error(`${at}: fence lang must be lower-case kebab`);
			if (langs.has(syntax.lang)) throw new Error(`${at}: fence lang "${syntax.lang}" is already used`);
			langs.add(syntax.lang);
		} else if (syntax.kind === "container" || syntax.kind === "leaf" || syntax.kind === "text") {
			if (syntax.directive !== block.name) throw new Error(`${at}: directive must equal the block name`);
			if (directives.has(syntax.directive)) throw new Error(`${at}: name or component is already used`);
			directives.add(syntax.directive);
		} else {
			throw new Error(`${at}: only container, leaf, text or fence blocks can be added`);
		}
		if (!COMPONENT.test(block.component)) throw new Error(`${at}: component must be PascalCase`);
		if (taken.has(block.name) || taken.has(block.component)) {
			throw new Error(`${at}: name or component is already used`);
		}
		if (syntax.kind === "text") {
			if (block.editor.view !== "mark") throw new Error(`${at}: a text block needs editor.view "mark"`);
			if (block.children || block.parent) throw new Error(`${at}: a text block has no children or parent`);
		} else if (block.editor.view !== "node" && block.editor.view !== "opaque") {
			throw new Error(`${at}: editor.view must be "node" or "opaque"`);
		}
		const anchors = Object.entries(block.attributes).filter(([, attribute]) => attribute.codeAnchor);
		if (anchors.length > 0 && (syntax.kind !== "text" || anchors.length > 1 || anchors[0]?.[1].type !== "string")) {
			throw new Error(`${at}: codeAnchor needs one string attribute of a text block`);
		}
		taken.add(block.name);
		taken.add(block.component);
	}
	const extra = added.map(({ block }) => block);
	const anchorBlocks = extra.filter((block) =>
		Object.values(block.attributes).some((attribute) => attribute.codeAnchor),
	);
	if (anchorBlocks.length > 1) {
		throw new Error(
			`cms.config: only one block can link code lines (codeAnchor): ${anchorBlocks.map((b) => b.name).join(", ")}`,
		);
	}
	const names = new Set(extra.map((block) => block.name));
	for (const { where, block } of added) {
		if (block.parent && !names.has(block.parent)) {
			throw new Error(`cms.config: ${where}: parent "${block.parent}" is not an added block`);
		}
		for (const child of block.children?.blocks ?? []) {
			// 더한 블록의 자식은 같이 더한 블록이다(편집기 노드를 같은 방식으로 만든다).
			if (!extra.some((candidate) => candidate.name === child && candidate.parent === block.name)) {
				throw new Error(`cms.config: ${where}: child "${child}" must be an added block with this parent`);
			}
		}
		for (const [name, attribute] of Object.entries(block.attributes)) {
			if (!attribute.childValue) continue;
			const children = (block.children?.blocks ?? []).map((child) => extra.find((c) => c.name === child));
			if (!children.some((child) => child && Object.hasOwn(child.attributes, attribute.childValue ?? ""))) {
				throw new Error(`cms.config: ${where}.attributes.${name}: no child block has "${attribute.childValue}"`);
			}
		}
	}
	return [...BUILTIN_BLOCKS, ...extra];
}
