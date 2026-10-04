import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "./remark-directives";

/**
 * CMS 본문 파서. 사이트의 공개 렌더(MDX 렌더러)와 해석이 갈리지 않도록
 * 같은 remark 구성을 쓴다.
 *
 * `remark-directive`는 등록 여부와 무관하게 모든 `:이름`을 directive 노드로 만든다.
 * 그래서 곧바로 {@link remarkDemoteUnknownDirectives}로 **미등록 이름을 본문 글자로 되돌리고**,
 * 이어서 {@link remarkDirectivesToMdx}로 등록 이름을 MDX 요소로 바꾼다.
 *
 * **저장 문자열은 여기서 바뀌지 않는다** — 트리만 공개 체인과 같은 모양이 된다. 이렇게 한 이유는
 * 분석기의 소비자들이 이름으로 노드를 찾기 때문이다: `::image{mediaId}`의 미디어 참조 수집,
 * `Tabs`·`Columns` 자식 개수 검증, 이벤트 핸들러·표현식 속성 검증이 directive용 코드를 따로
 * 갖지 않는다(두 shape로 갈라지면 한쪽만 고치는 실수가 난다).
 */
const processor = unified()
	.use(remarkParse)
	.use(remarkMdx)
	.use(remarkGfm)
	.use(remarkMath, { singleDollarTextMath: false })
	.use(remarkDirective)
	.use(remarkDemoteUnknownDirectives)
	.use(remarkDirectivesToMdx);

export const parseMdxAst = (body: string): Root => {
	// 단일 `$` 인라인 수식은 끈다. 본문에 jQuery `$` 같은 기호가 흔해 수식으로 오인되면
	// 공개 렌더러(remarkDisableInlineMath)와 해석이 갈리고 왕복이 깨진다. 블록 `$$` 수식은 유지한다.
	const file = new VFile({ value: body });
	const tree = processor.parse(file);

	// 두 플러그인 모두 transformer다. `.parse()`만 호출하면 실행되지 않아
	// 미등록 이름이 directive로 남고 등록 이름은 MDX 요소가 되지 않는다.
	processor.runSync(tree, file);

	return tree as Root;
};
