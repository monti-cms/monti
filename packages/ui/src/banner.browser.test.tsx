import * as React from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Banner, Box, PageBanner, StandalonePage, TextButton } from "./index";

const LONG =
	"저장하지 못했습니다. 게시글 컬렉션의 공개 주소 /posts/:slug 를 메모 컬렉션이 이미 쓰고 있고, 미리보기 주소 /preview/:slug 는 다른 컬렉션의 미리보기 주소와 같아서 구조를 적용할 수 없습니다.";

const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
const banner = () => page.getByTestId("banner");

describe("Banner", () => {
	it("a sentence longer than the line ends in an ellipsis inside the banner, its action stays whole, and a pointer or the keyboard on it reads it whole", async () => {
		render(
			<Box width="sheet">
				<Banner data-testid="banner" tone="danger" title={LONG}>
					<TextButton>다시 저장</TextButton>
				</Banner>
			</Box>,
		);
		await expect.element(banner()).toBeVisible();
		const box = banner().element().getBoundingClientRect();
		const words = banner().element().querySelector("[data-slot=banner-title]") as HTMLElement;
		// One line, cut inside the banner: nothing runs out of it, and the cut shows as "…".
		expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);
		expect(getComputedStyle(words).textOverflow).toBe("ellipsis");
		expect(words.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
		expect(banner().element().scrollWidth).toBeLessThanOrEqual(banner().element().clientWidth);
		// The action is whole, at the right end.
		const action = page.getByRole("button", { name: "다시 저장" }).element().getBoundingClientRect();
		expect(action.right).toBeLessThanOrEqual(box.right);
		expect(action.left).toBeGreaterThanOrEqual(words.getBoundingClientRect().right);
		// A reader of the page gets the whole sentence; a pointer on the cut words gets it too, in the tooltip every cut text has.
		expect(words.textContent).toBe(LONG);
		await userEvent.hover(words, { position: { x: 12, y: 8 } });
		await expect.poll(tip).toBe(LONG);
		await userEvent.keyboard("{Escape}");
		await expect.poll(tip).toBe(null);
		await userEvent.hover(page.getByRole("button", { name: "다시 저장" }));
		// The keyboard alone reads it too: while they are cut the words are a stop before the action.
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(words);
		await expect.poll(tip).toBe(LONG);
		await userEvent.keyboard("{Tab}");
		await expect.element(page.getByRole("button", { name: "다시 저장" })).toHaveFocus();
		await expect.poll(tip).toBe(null);
	});

	it("a sentence that fits says nothing more to a pointer on it, and is no stop of the keyboard", async () => {
		render(
			<Banner data-testid="banner" title="한국어 원문 변경" meta="10. 26 · 블록 2개">
				<TextButton>확인</TextButton>
			</Banner>,
		);
		await expect.element(banner()).toBeVisible();
		const words = banner().element().querySelector("[data-slot=banner-title]") as HTMLElement;
		await userEvent.hover(words);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
		expect(words.hasAttribute("tabindex")).toBe(false);
		await userEvent.keyboard("{Tab}");
		await expect.element(page.getByRole("button", { name: "확인" })).toHaveFocus();
	});

	// T157. What a screen reader does with this was not listened to: this is the contract of the page that readers are known to follow. A live
	// region is read when its content changes, so it is in the page, empty, before the words; a region that arrives with its words may be skipped.
	it("is said through a live region that was in the page before it: the top place, empty first, the banner added to it afterwards", async () => {
		function Screen() {
			const [failed, setFailed] = React.useState(0);
			const [refused, setRefused] = React.useState(false);
			return (
				<StandalonePage
					banner={failed > 0 ? <Banner tone="danger" title={`전송 ${failed}건 실패`} meta="10. 26부터" /> : null}
				>
					<TextButton onClick={() => setFailed((count) => count + 1)}>실패</TextButton>
					<TextButton onClick={() => setRefused(true)}>거절</TextButton>
					{refused ? (
						<PageBanner>
							<Banner tone="danger" title="저장하지 못했습니다" />
						</PageBanner>
					) : null}
				</StandalonePage>
			);
		}
		render(<Screen />);
		await expect.element(page.getByRole("button", { name: "실패" })).toBeVisible();
		// The region is there with no banner: polite, holding no words, and only what is added or changed in it is read.
		const region = document.querySelector("[aria-live]") as HTMLElement;
		expect(region).not.toBeNull();
		expect(region.getAttribute("aria-live")).toBe("polite");
		expect(region.getAttribute("aria-atomic")).toBe("false");
		expect(region.getAttribute("aria-relevant")).toBe("additions text");
		expect(region.textContent).toBe("");
		expect(region.contains(page.getByRole("button", { name: "실패" }).element())).toBe(false);
		/** What was added to the region, as a reader is told of it: each added node's words. */
		const added: string[] = [];
		const watch = new MutationObserver((changes) => {
			for (const change of changes)
				for (const node of change.addedNodes) if (node.textContent) added.push(node.textContent);
		});
		watch.observe(region, { childList: true, subtree: true, characterData: true });

		await userEvent.click(page.getByRole("button", { name: "실패" }));
		await expect.poll(() => added.some((words) => words.includes("전송 1건 실패"))).toBe(true);
		// The same region as before the banner; the banner is in it, is no live region itself, and its words are in the page once.
		expect(document.querySelectorAll("[aria-live]").length).toBe(1);
		const box = document.querySelector("[data-slot=banner]") as HTMLElement;
		expect(region.contains(box)).toBe(true);
		expect(box.getAttribute("role")).toBe("note");
		expect(box.hasAttribute("aria-live")).toBe(false);
		expect(document.body.textContent?.split("전송 1건 실패").length).toBe(2);

		// Changed words are a change inside the region; a page's own banner is drawn into the same region, as an addition of its own.
		await userEvent.click(page.getByRole("button", { name: "실패" }));
		await expect.element(page.getByText("전송 2건 실패")).toBeVisible();
		expect(region.contains(page.getByText("전송 2건 실패").element())).toBe(true);
		await userEvent.click(page.getByRole("button", { name: "거절" }));
		await expect.poll(() => added.some((words) => words.includes("저장하지 못했습니다"))).toBe(true);
		expect(region.contains(page.getByText("저장하지 못했습니다").element())).toBe(true);
		watch.disconnect();
	});
});
