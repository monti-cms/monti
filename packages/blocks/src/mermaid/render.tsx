import { MermaidView } from "./render.client";

/** Mermaid 블록(` ```mermaid `)의 그리기. 코드는 `source` 속성이다(`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }: { source?: string }) {
	return <MermaidView source={source ?? ""} />;
}

/** Mermaid의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). 다이어그램은 브라우저에서 그린다(선택 의존성 `mermaid`). */
export default () => ({ Mermaid });
