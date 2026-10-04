import { BLOCK_JSX_NAMES, DIRECTIVES, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "@monti-cms/core/mdx";
import { describe, expect, it, vi } from "vitest";

// 블록은 플러그인(`blocks()`)으로 넣은 설정으로 돌려, 공개 컴포넌트가 플러그인 `render`에서 오게 한다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { mdxComponents } = await import("@monti-cms/core/render");

/**
 * 이름 정합성. 등록된 이름에 공개 컴포넌트·레지스트리가 빠지면 공개 글이 조용히 비어 보인다
 * ("If directives are not handled, they do not emit anything"). 공개 컴포넌트는 본체 기본 + 블록 확장이 합친 표(`mdxComponents()`)다.
 */
describe("레지스트리·공개 컴포넌트 대조", () => {
	it("등록 directive의 컴포넌트가 합친 컴포넌트 표에 있다", async () => {
		const components = await mdxComponents();
		const missing = DIRECTIVES.filter(
			(definition) => /^[A-Z]/.test(definition.component) && !(definition.component in components),
		).map((definition) => definition.name);

		expect(missing).toEqual([]);
	});

	it("등록 directive의 컴포넌트 이름이 레지스트리에도 있다", () => {
		const missing = DIRECTIVES.filter((definition) => !REGISTERED_JSX_NAMES.has(definition.component)).map(
			(definition) => definition.name,
		);

		expect(missing).toEqual([]);
	});

	it("폐기 이름은 레지스트리·공개 컴포넌트 어디에도 없다", async () => {
		const components = await mdxComponents();
		expect([...RETIRED_JSX_NAMES].sort()).toEqual(["ContentLink", "IdeographicSpace"]);
		for (const name of RETIRED_JSX_NAMES) {
			expect(REGISTERED_JSX_NAMES.has(name)).toBe(false);
			expect(BLOCK_JSX_NAMES.has(name)).toBe(false);
			expect(name in components).toBe(false);
		}
	});
});
