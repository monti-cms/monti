import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { ChangeDot } from "./change-dot";
import { FieldRow, FieldTree } from "./field-tree";
import { FolderTab, FolderTabs, FolderTabsList } from "./folder-tabs";
import { Label } from "./label";
import { LockMark } from "./lock-mark";

it("the lock says why when pointed at: its name in a tooltip, the one a screen reader hears; the change dot has none", async () => {
	render(
		<p>
			공개 주소 <LockMark label="운영 사이트에서는 잠김" /> 미리보기 주소 <ChangeDot label="변경" />
		</p>,
	);
	const lock = page.getByRole("img", { name: "운영 사이트에서는 잠김" });
	await expect.element(lock).toBeVisible();
	// The mark itself, where the screens and their tests find it.
	expect(lock.element().matches("[data-slot=lock-mark]")).toBe(true);
	const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
	expect(tip()).toBe(null);
	await userEvent.hover(lock);
	// A longer wait than the default second: slow on CI's first open, as the table's tooltips are.
	await expect.poll(tip, { timeout: 5000 }).toBe("운영 사이트에서는 잠김");

	const dot = page.getByRole("img", { name: "변경" });
	await userEvent.hover(dot);
	await expect.poll(tip, { timeout: 5000 }).toBe(null);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(tip()).toBe(null);
});

it("a lock without words has no tooltip: nothing shows when it is pointed at", async () => {
	render(
		<p>
			식별자 <LockMark label="" />
		</p>,
	);
	const found = () => document.querySelector("[data-slot=lock-mark]");
	await expect.poll(found).not.toBeNull();
	await userEvent.hover(page.elementLocator(found() as Element));
	await new Promise((resolve) => setTimeout(resolve, 600));
	expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
});

const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;

// T192: the reason of a lock reaches the one who looks and uses no pointer (WCAG 1.4.13).
it("the keyboard stops on a lock and reads why, with a ring around the mark; a lock without words is no stop", async () => {
	render(
		<p>
			<button type="button">앞</button>
			공개 주소 <LockMark label="운영 사이트에서는 잠김" /> 식별자 <LockMark label="" />
			<button type="button">뒤</button>
		</p>,
	);
	await expect.element(page.getByRole("button", { name: "앞" })).toBeVisible();
	await userEvent.keyboard("{Tab}{Tab}");
	const lock = page.getByRole("img", { name: "운영 사이트에서는 잠김" });
	await expect.element(lock).toHaveFocus();
	await expect.poll(tip, { timeout: 5000 }).toBe("운영 사이트에서는 잠김");
	expect(getComputedStyle(lock.element()).boxShadow).not.toBe("none");
	// On to the next control: the lock without words is passed, and the tooltip goes.
	await userEvent.keyboard("{Tab}");
	await expect.element(page.getByRole("button", { name: "뒤" })).toHaveFocus();
	await expect.poll(tip).toBe(null);
});

it("after a label's words the lock stands 6px from them, as after any text", async () => {
	render(
		<Label>
			<span data-testid="words">공개 주소</span>
			<LockMark label="운영 사이트에서는 잠김" />
		</Label>,
	);
	const lock = page.getByRole("img", { name: "운영 사이트에서는 잠김" });
	await expect.element(lock).toBeVisible();
	const gap =
		lock.element().getBoundingClientRect().left - page.getByTestId("words").element().getBoundingClientRect().right;
	expect(Math.round(gap)).toBe(6);
});

it("a field row's lock and dots stand over the row's button: the pointer finds them, the lock says why, and the keyboard reaches it after the row", async () => {
	const opened: string[] = [];
	render(
		<FieldTree>
			<FieldRow
				name="seo.image"
				label="공유 이미지"
				kind="image"
				locked="SEO 플러그인이 둔 필드"
				changed
				changedLabel="변경"
				onOpen={() => opened.push("row")}
				openLabel="seo.image 열기"
			/>
		</FieldTree>,
	);
	const lock = page.getByRole("img", { name: "SEO 플러그인이 둔 필드" });
	await expect.element(lock).toBeVisible();
	const onTop = (element: Element) => {
		const box = element.getBoundingClientRect();
		return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
	};
	expect(lock.element().contains(onTop(lock.element()))).toBe(true);
	const dot = page.getByRole("img", { name: "변경" }).element();
	expect(onTop(dot)).toBe(dot);
	await userEvent.hover(lock);
	await expect.poll(tip, { timeout: 5000 }).toBe("SEO 플러그인이 둔 필드");
	await userEvent.unhover(lock);
	await expect.poll(tip).toBe(null);
	// A press on a mark opens the row, as a press beside it does.
	await userEvent.click(lock);
	await userEvent.click(page.getByRole("img", { name: "변경" }));
	expect(opened).toEqual(["row", "row"]);
	// The keyboard: the row's name first, then its lock.
	(page.getByRole("button", { name: "seo.image 열기" }).element() as HTMLElement).focus();
	await userEvent.keyboard("{Tab}");
	await expect.element(lock).toHaveFocus();
	await expect.poll(tip, { timeout: 5000 }).toBe("SEO 플러그인이 둔 필드");
});

it("a locked folder tab names its lock and says why to a pointer on the tab and to the keyboard on it", async () => {
	render(
		<FolderTabs value="basic">
			<FolderTabsList>
				<FolderTab value="basic" count={7}>
					기본
				</FolderTab>
				<FolderTab value="seo" count={2} locked="SEO 플러그인이 둔 탭" draggable={false}>
					SEO
				</FolderTab>
			</FolderTabsList>
		</FolderTabs>,
	);
	const tab = page.getByRole("tab", { name: /SEO/ });
	await expect.element(tab).toBeVisible();
	await expect.element(tab.getByRole("img", { name: "SEO 플러그인이 둔 탭" })).toBeVisible();
	await userEvent.hover(tab);
	await expect.poll(tip, { timeout: 5000 }).toBe("SEO 플러그인이 둔 탭");
	await userEvent.unhover(tab);
	await expect.poll(tip).toBe(null);
	// The keyboard: the tab row is one stop, the arrow keys move in it.
	await userEvent.keyboard("{Tab}{ArrowRight}");
	await expect.element(tab).toHaveFocus();
	await expect.poll(tip, { timeout: 5000 }).toBe("SEO 플러그인이 둔 탭");
});
