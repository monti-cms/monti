import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "@monti-cms/core/mdx";
import { compileMDX } from "next-mdx-remote/rsc";
import { renderToStaticMarkup } from "react-dom/server";
import remarkDirective from "remark-directive";
import { describe, expect, it, vi } from "vitest";

// 블록은 플러그인(`blocks()`)으로 넣은 설정으로 돌려, 공개 컴포넌트가 플러그인 `render`에서 오게 한다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { mdxComponents, mdxRehypePlugins, mdxRemarkPlugins, renderMdx } = await import("@monti-cms/core/render");

const renderPublic = async (source: string): Promise<string> => renderToStaticMarkup((await renderMdx(source)).content);

/** 지시자 플러그인 3개만 뺀 체인. 실제 공개 체인(`mdxRemarkPlugins`)과 같은 컴포넌트·rehype로 그린다. */
const renderWithoutDirectives = async (source: string): Promise<string> => {
	const plugins = mdxRemarkPlugins().filter((entry) => {
		const plugin = Array.isArray(entry) ? entry[0] : entry;
		return plugin !== remarkDirective && plugin !== remarkDemoteUnknownDirectives && plugin !== remarkDirectivesToMdx;
	});
	const { content } = await compileMDX({
		source,
		options: { mdxOptions: { remarkPlugins: plugins, rehypePlugins: mdxRehypePlugins() } },
		components: await mdxComponents(),
	});
	return renderToStaticMarkup(content);
};

describe("지시자 렌더 등가성 — 지시자를 쓰지 않는 글", () => {
	it("지시자를 쓰지 않는 본문은 지시자 플러그인이 붙어도 렌더가 같다", async () => {
		// 지시자로 바뀐 본문은 지시자 플러그인 없이는 아무것도 출력하지 않는다(그게 그 플러그인의 존재 이유다).
		// 그래서 **추가형** 성질은 지시자를 쓰지 않는 본문으로 고정한다: 수식 `$`·표·코드 펜스·
		// 레거시 JSX·하드브레이크·미등록 `:이름`이 섞인 표본.
		const samples = [
			"문장 안의 $기호와 `코드` 그리고 **강조**",
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			'<Callout variant="note">\n\n레거시 JSX도 그대로\n\n</Callout>',
			"첫 줄\\\n둘째 줄",
			"```ts\nconst a = 1;\n```",
			"<u>밑줄</u>과 :free를 같은 산문",
		];

		const mismatches: string[] = [];
		for (const sample of samples) {
			const [before, after] = await Promise.all([renderWithoutDirectives(sample), renderPublic(sample)]);
			if (before !== after) mismatches.push(sample);
		}

		expect(mismatches).toEqual([]);
	});
});

describe("지시자 렌더(본체 기본 컴포넌트)", () => {
	it("강제 줄바꿈은 :br[] 로 그린다(뒤에 한글이 붙어도 안전한 형태)", async () => {
		// 이름은 뒤따르는 글자를 삼킨다. 한글도 이름 문자라 `:br둘째`는 이름 `br둘째`가 되어
		// 미등록으로 처리되고 `:br` 글자가 그대로 출력된다. 그래서 직렬화는 항상 빈 라벨을 붙인다.
		const safe = await renderPublic("첫 줄:br[]둘째 줄");
		const ambiguous = await renderPublic("첫 줄:br둘째 줄");

		expect(safe).toContain("<br/>");
		expect(safe).not.toContain(":br");
		expect(ambiguous).toContain(":br둘째");
		expect(ambiguous).not.toContain("<br/>");
	});

	it("해석할 수 없는 이미지는 중립 자리와 캡션만 남긴다", async () => {
		const unresolved = await renderPublic(
			'::image{mediaId="00000000-0000-0000-0000-000000000000" alt="대체텍스트" caption="캡션"}',
		);
		const rejected = await renderPublic('::image{src="javascript:alert(1)" alt="대체텍스트" caption="캡션"}');
		const noCaption = await renderPublic('::image{mediaId="00000000-0000-0000-0000-000000000000"}');

		for (const html of [unresolved, rejected, noCaption]) {
			expect(html).not.toContain("<img");
			// 내부 실패 사유·alt 글자로 대체하지 않는다. width·align도 적용하지 않는다.
			expect(html).toContain("cms-image-unavailable");
			expect(html).not.toContain("대체텍스트");
			expect(html).not.toContain("width:");
		}
		expect(unresolved).toContain("캡션");
		expect(rejected).toContain("캡션");
		expect(noCaption).not.toContain("<figcaption");
	});

	it("미등록 이름은 본문 글자로 남는다(무음 손실 0)", async () => {
		const inline = await renderPublic("openai/gpt-oss-120b:free를 쓴다.");
		const container = await renderPublic(":::unknown\n안쪽 :free를 그대로\n:::");

		expect(inline).toContain("gpt-oss-120b:free를");
		expect(container).toContain("안쪽 :free를 그대로");
	});
});
