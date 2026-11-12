import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Banner, Box, TextButton } from "./index";

const LONG =
	"저장하지 못했습니다. 게시글 컬렉션의 공개 주소 /posts/:slug 를 메모 컬렉션이 이미 쓰고 있고, 미리보기 주소 /preview/:slug 는 다른 컬렉션의 미리보기 주소와 같아서 구조를 적용할 수 없습니다.";

describe("Banner", () => {
	it("a sentence longer than the line ends in an ellipsis inside the banner, its action stays whole, and a pointer on it reads it whole", async () => {
		render(
			<Box width="sheet">
				<Banner tone="danger" title={LONG}>
					<TextButton>다시 저장</TextButton>
				</Banner>
			</Box>,
		);
		const banner = page.getByRole("status");
		await expect.element(banner).toBeVisible();
		const box = banner.element().getBoundingClientRect();
		const words = banner.element().querySelector("[data-slot=banner-title]") as HTMLElement;
		// One line, cut inside the banner: nothing runs out of it, and the cut shows as "…".
		expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);
		expect(getComputedStyle(words).textOverflow).toBe("ellipsis");
		expect(words.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
		expect(banner.element().scrollWidth).toBeLessThanOrEqual(banner.element().clientWidth);
		// The action is whole, at the right end.
		const action = page.getByRole("button", { name: "다시 저장" }).element().getBoundingClientRect();
		expect(action.right).toBeLessThanOrEqual(box.right);
		expect(action.left).toBeGreaterThanOrEqual(words.getBoundingClientRect().right);
		// A reader of the page gets the whole sentence; a pointer on the cut words gets it too.
		expect(words.textContent).toBe(LONG);
		await userEvent.hover(words);
		expect(words.title).toBe(LONG);
	});

	it("a sentence that fits says nothing more to a pointer on it", async () => {
		render(
			<Banner title="한국어 원문 변경" meta="10. 26 · 블록 2개">
				<TextButton>확인</TextButton>
			</Banner>,
		);
		const banner = page.getByRole("status");
		await expect.element(banner).toBeVisible();
		const words = banner.element().querySelector("[data-slot=banner-title]") as HTMLElement;
		await userEvent.hover(words);
		expect(words.hasAttribute("title")).toBe(false);
	});
});
