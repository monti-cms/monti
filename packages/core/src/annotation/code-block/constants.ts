import { type CodeLineEffectDefinition, DEFAULT_CODE_LINE_EFFECTS } from "./line-effects";
import type { AnnotationConfig, AnnotationConfigItem } from "./types";

/** 글자 효과(`// @char 이름`). 공개 화면이 렌더러 이름(`render`)으로 그린다. */
const CHAR_ANNOTATIONS: readonly AnnotationConfigItem[] = ["Tooltip", "strong", "em", "del", "u", "fold"].map(
	(name) => ({ name, kind: "render", source: "mdx-text", render: name, scopes: ["char", "document"] }),
);

/**
 * 코드 펜스 주석 설정. 글자 효과, 줄 효과(정의 목록), 줄 접기, 본문 연결 이름표 순서다.
 * 사이트가 쓰는 설정은 `active.ts`의 `annotationConfig`다.
 */
export function createAnnotationConfig(
	lineEffects: readonly CodeLineEffectDefinition[] = DEFAULT_CODE_LINE_EFFECTS,
): AnnotationConfig {
	return {
		annotations: [
			...CHAR_ANNOTATIONS,
			...lineEffects.map(
				(effect): AnnotationConfigItem => ({
					name: effect.name,
					kind: "class",
					class: effect.class,
					scopes: ["line"],
				}),
			),
			{ name: "collapse", kind: "render", render: "collapse", scopes: ["line"] },
			// 본문 `:code-ref`가 가리키는 줄 이름표(`id`). 줄에 `data-anchor`를 달 뿐 모양은 없다.
			{ name: "anchor", kind: "class", class: "code-anchor", scopes: ["line"] },
		],
	};
}
