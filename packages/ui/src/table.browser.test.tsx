import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { onTopOf, titleUnderPointer } from "../../../testing/input";
import { render } from "../test/render";
import {
	ListScroll,
	LocaleCodes,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "./index";

function rows(opened: (held: { newTab: boolean }) => void, rowPressed?: () => void) {
	return (
		<ListScroll>
			<Table container="none" layout="fixed" columns={[60, undefined, 84, 48]}>
				<TableBody>
					<TableRow onClick={rowPressed}>
						<TableCell>
							<RowCheck checked={false} onCheckedChange={() => {}} label="첫 번째 글 고르기" />
							<LocaleCodes codes={["ko", "en", "ja"]} names="한국어, 영어, 일본어" />
						</TableCell>
						<TableCell truncate>
							<RowTitle
								title={
									<RowLink
										href="#/first"
										onClick={(event) => {
											event.preventDefault();
											opened({ newTab: event.metaKey || event.ctrlKey });
										}}
									>
										첫 번째 글
									</RowLink>
								}
								address="/posts/first-post"
							/>
						</TableCell>
						<TableCell tone="subtle" truncate title="개발">
							개발
						</TableCell>
						<TableCell>
							<RowActions>
								<RowMore label="더 보기" />
							</RowActions>
						</TableCell>
					</TableRow>
					{/* The same row without a `title` on its cell. */}
					<TableRow>
						<TableCell>
							<RowCheck checked={false} onCheckedChange={() => {}} label="두 번째 글 고르기" />
							<LocaleCodes codes={["ko"]} names="한국어" />
						</TableCell>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/second">두 번째 글</RowLink>} address="/posts/second-post" />
						</TableCell>
						<TableCell tone="subtle" truncate>
							일상
						</TableCell>
						<TableCell>
							<RowActions>
								<RowMore label="두 번째 글 더 보기" />
							</RowActions>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</ListScroll>
	);
}

describe("Table rows with a link", () => {
	it("the pointer finds what stands over the row's link: a titled cell's words, the address, the languages before the title", async () => {
		render(rows(() => {}));
		await expect.element(page.getByText("개발")).toBeVisible();
		expect(titleUnderPointer(page.getByText("개발").element())).toBe("개발");
		expect(titleUnderPointer(page.getByText("/posts/first-post").element())).toBe("/posts/first-post");
		expect(onTopOf(page.getByText("KO +2").element())?.closest("[data-slot=locale-codes]")).not.toBeNull();
	});

	it("a press on them opens the row once; with a key held or the middle button it opens the row's address in another place; a control keeps its own press", async () => {
		const opened = vi.fn();
		const rowPressed = vi.fn();
		const elsewhere = vi.spyOn(window, "open").mockReturnValue(null);
		render(rows(opened, rowPressed));
		await userEvent.click(page.getByText("개발"));
		expect(opened).toHaveBeenCalledTimes(1);
		expect(rowPressed).toHaveBeenCalledTimes(1);
		await userEvent.click(page.getByText("KO +2"));
		expect(opened).toHaveBeenCalledTimes(2);
		expect(opened).toHaveBeenLastCalledWith({ newTab: false });
		opened.mockClear();
		// A key held with the press, or the middle button, asks for another place: the row's address is opened there during the press, and this
		// page stays as it is.
		await userEvent.click(page.getByText("개발"), { modifiers: ["Meta"] });
		await userEvent.click(page.getByText("개발"), { modifiers: ["Shift"] });
		await userEvent.click(page.getByText("개발"), { button: "middle" });
		expect(elsewhere.mock.calls.map(([address]) => String(address).replace(/^.*#/, "#"))).toEqual([
			"#/first",
			"#/first",
			"#/first",
		]);
		expect(opened).not.toHaveBeenCalled();

		// The middle button held there does not start the browser's own scrolling: the row has an address to open.
		const held = (on: Element) => {
			const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 1 });
			on.dispatchEvent(press);
			return press.defaultPrevented;
		};
		expect(held(page.getByText("개발").element())).toBe(true);
		expect(held(page.getByRole("button", { name: "더 보기", exact: true }).element())).toBe(false);

		await userEvent.click(page.getByRole("button", { name: "더 보기", exact: true }));
		await userEvent.click(page.getByRole("checkbox", { name: "첫 번째 글 고르기" }), { force: true });
		expect(opened).not.toHaveBeenCalled();
		elsewhere.mockRestore();
	});

	it("short of room, what stands after a title gives way first: the title is whole while the address has anything left, and only then is cut", async () => {
		const row = (width: number) => (
			// The last column takes the room that is left, so the first keeps its width.
			<Table container="none" layout="fixed" columns={[width, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#">CMS elements: details</RowLink>} address="/cms-elements-details" />
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>
		);
		// The box that cuts the words (the words' own, or the one that holds a link), and whether its words are wider than it is, to a hundredth of a pixel:
		// a title that gives way by a tenth of one already ends in "…".
		const box = (words: string) => {
			const found = page.getByText(words).element().closest(".truncate");
			if (!found) throw new Error(`Nothing cuts "${words}".`);
			return found;
		};
		const cut = (words: string) => {
			const range = document.createRange();
			range.selectNodeContents(box(words));
			return range.getBoundingClientRect().width > box(words).getBoundingClientRect().width + 0.01;
		};
		const host = render(row(260));
		await expect.element(page.getByText("CMS elements: details")).toBeVisible();
		expect(cut("/cms-elements-details")).toBe(true);
		expect(cut("CMS elements: details")).toBe(false);
		host.remove();
		render(row(120));
		await expect.element(page.getByText("CMS elements: details")).toBeVisible();
		expect(cut("CMS elements: details")).toBe(true);
		const cell = box("CMS elements: details").closest("td") as HTMLElement;
		expect(box("CMS elements: details").getBoundingClientRect().right).toBeLessThanOrEqual(
			cell.getBoundingClientRect().right,
		);
	});

	it("at every width the address shows a letter and its … or is off the line, and a title that fits the line is whole (T127)", async () => {
		const host = render(
			<Table container="none" layout="fixed">
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#">CMS elements: details</RowLink>} address="/cms-elements-details" />
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		await expect.element(page.getByText("CMS elements: details")).toBeVisible();
		const title = page.getByText("CMS elements: details").element().closest(".truncate") as HTMLElement;
		const address = page.getByText("/cms-elements-details").element() as HTMLElement;
		const line = address.parentElement as HTMLElement;
		const wide = (node: HTMLElement) => {
			const all = document.createRange();
			all.selectNodeContents(node);
			return all.getBoundingClientRect().width;
		};
		// A letter and its "…" in the address's own letters: less than this is a letter cut through.
		const least = address.cloneNode(false) as HTMLElement;
		least.textContent = "/…";
		least.style.cssText = "position:absolute;flex:none;max-width:none";
		line.append(least);
		const letter = least.getBoundingClientRect().width;
		least.remove();
		const seen = { shown: 0, gone: 0, whole: 0, cut: 0 };
		for (let width = 360; width >= 60; width--) {
			host.style.width = `${width}px`;
			const room = line.getBoundingClientRect();
			const at = `at ${width}px`;
			// The address is on the line or below it, where the line's height hides it.
			if (address.getBoundingClientRect().top < room.bottom - 1) {
				seen.shown++;
				expect(address.getBoundingClientRect().width, at).toBeGreaterThanOrEqual(letter - 0.01);
			} else seen.gone++;
			if (wide(title) <= room.width + 0.01) {
				seen.whole++;
				expect(title.getBoundingClientRect().width, at).toBeGreaterThanOrEqual(wide(title) - 0.01);
			} else seen.cut++;
			expect(title.getBoundingClientRect().right, at).toBeLessThanOrEqual(room.right + 0.01);
		}
		// The sweep went through every case.
		for (const count of Object.values(seen)) expect(count).toBeGreaterThan(0);
	});

	it("a row that opens a panel has no address: the middle button there is left to the browser", async () => {
		const opened = vi.fn();
		render(
			<Table container="none" layout="fixed" columns={[undefined, 84]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle
								title={
									<RowLink render={<button type="button" />} onClick={opened}>
										임시
									</RowLink>
								}
							/>
						</TableCell>
						<TableCell tone="subtle" truncate title="태그">
							태그
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		await expect.element(page.getByText("태그")).toBeVisible();
		const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 1 });
		page.getByText("태그").element().dispatchEvent(press);
		expect(press.defaultPrevented).toBe(false);
		const elsewhere = vi.spyOn(window, "open").mockReturnValue(null);
		await userEvent.click(page.getByText("태그"), { button: "middle" });
		expect(opened).not.toHaveBeenCalled();
		// A plain press opens the panel, and one with a key held reaches the row's button with the key.
		await userEvent.click(page.getByText("태그"));
		expect(opened).toHaveBeenCalledTimes(1);
		await userEvent.click(page.getByText("태그"), { modifiers: ["Meta"] });
		expect(opened).toHaveBeenCalledTimes(2);
		expect(opened.mock.calls[1]?.[0]).toMatchObject({ metaKey: true });
		expect(elsewhere).not.toHaveBeenCalled();
		elsewhere.mockRestore();
	});

	it("words dragged over to select them do not open the row", async () => {
		const opened = vi.fn();
		render(rows(opened));
		await expect.element(page.getByText("개발")).toBeVisible();
		const words = page.getByText("개발").element();
		// A drag ends in a click on the words, with them selected.
		window.getSelection()?.selectAllChildren(words);
		words.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(opened).not.toHaveBeenCalled();
		window.getSelection()?.removeAllRanges();
		words.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(opened).toHaveBeenCalledTimes(1);
	});

	it("a press in a table inside a row opens that table's row, not the row around it; a row's own press is heard when another row's link makes it", async () => {
		const [outer, inner, other] = [vi.fn(), vi.fn(), vi.fn()];
		const link = (name: string, opened: () => void) => (
			<RowTitle
				title={
					<RowLink
						href={`#/${name}`}
						onClick={(event) => {
							event.preventDefault();
							opened();
						}}
					>
						{name}
					</RowLink>
				}
			/>
		);
		render(
			<Table container="none" layout="fixed" columns={[undefined, 240]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>{link("바깥", outer)}</TableCell>
						<TableCell>
							<Table container="none" layout="fixed" columns={[undefined, 84]}>
								<TableBody>
									<TableRow>
										<TableCell truncate>{link("안", inner)}</TableCell>
										<TableCell tone="subtle" truncate title="안쪽 값">
											안쪽 값
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</TableCell>
					</TableRow>
					<TableRow>
						<TableCell truncate>
							{link("누르는 행", () =>
								page
									.getByText("제 누름")
									.element()
									.dispatchEvent(new MouseEvent("click", { bubbles: true })),
							)}
						</TableCell>
						<TableCell tone="subtle" truncate title="건너">
							건너
						</TableCell>
					</TableRow>
					<TableRow onClick={other}>
						<TableCell>제 누름</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>,
		);
		await userEvent.click(page.getByText("안쪽 값"));
		expect(inner).toHaveBeenCalledTimes(1);
		expect(outer).not.toHaveBeenCalled();
		// The third row's link, reached through what stands over it, presses the fourth row while its own press is on its way: the fourth hears it.
		await userEvent.click(page.getByText("건너"));
		expect(other).toHaveBeenCalledTimes(1);
	});

	it("a cut title says itself whole when its words are pointed at or come to with the keyboard, and not from the rest of the row", async () => {
		const long = "리액트 19 마이그레이션에서 서버 컴포넌트와 액션을 옮기며 배운 것";
		render(
			// The last column takes the room that is left, so the first two keep their widths.
			<Table container="none" layout="fixed" columns={[200, 200, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/long">{long}</RowLink>} />
						</TableCell>
						<TableCell tone="subtle">가운데</TableCell>
						<TableCell />
					</TableRow>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/short">짧은 글</RowLink>} />
						</TableCell>
						<TableCell tone="subtle">옆 칸</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>,
		);
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		// How long the tooltip is waited for. CI failed here twice (#468, #470) with the default second, on the first open, and it never failed
		// on a developer's machine: with a longer wait, a failure means the tooltip does not open at all, not that the machine was slow.
		const shown = { timeout: 5000 };
		// Near their start: the words run on under the cut, past where they show.
		await userEvent.hover(page.getByText(long), { position: { x: 12, y: 8 } });
		await expect.poll(tip, shown).toBe(long);
		// Escape closes it, and it stays closed while the pointer stays on the words, however it moves there.
		await userEvent.keyboard("{Escape}");
		await expect.poll(tip).toBe(null);
		await userEvent.hover(page.getByText(long), { position: { x: 20, y: 9 } });
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
		// The link covers the row: over another cell the pointer is still on the link, and the title is not said. Back on the words it is said again,
		// and while it closes it keeps its words: it never shows empty.
		await userEvent.hover(page.getByText("가운데"), { force: true });
		await userEvent.hover(page.getByText(long), { position: { x: 12, y: 8 } });
		await expect.poll(tip, shown).toBe(long);
		const seen: (string | null)[] = [];
		const watch = setInterval(() => seen.push(tip()), 10);
		await userEvent.hover(page.getByText("가운데"), { force: true });
		await expect.poll(tip).toBe(null);
		clearInterval(watch);
		expect(seen).not.toContain("");
		// A title that fits says nothing.
		await userEvent.hover(page.getByText("짧은 글"));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
		await userEvent.unhover(page.getByText("짧은 글"));
		// The keyboard comes to the first link of the page, the long title's.
		await userEvent.keyboard("{Tab}");
		await expect.element(page.getByRole("link", { name: long })).toHaveFocus();
		await expect.poll(tip, shown).toBe(long);
		// Opened from the keyboard and closed by hand with the pointer on the words, it stays closed too. A press closes it as Escape does.
		await userEvent.hover(page.getByRole("link", { name: long }), { position: { x: 12, y: 8 } });
		await userEvent.keyboard("{Escape}");
		await expect.poll(tip).toBe(null);
		await userEvent.hover(page.getByRole("link", { name: long }), { position: { x: 24, y: 9 } });
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
		await userEvent.hover(page.getByText("가운데"), { force: true });
		await userEvent.hover(page.getByRole("link", { name: long }), { position: { x: 12, y: 8 } });
		await expect.poll(tip, shown).toBe(long);
		const words = page.getByRole("link", { name: long }).element();
		words.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
		await expect.poll(tip).toBe(null);
		await userEvent.hover(page.getByRole("link", { name: long }), { position: { x: 30, y: 9 } });
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
		// A finger on the words does not point.
		await userEvent.hover(page.getByText("가운데"), { force: true });
		const box = words.getBoundingClientRect();
		words.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerType: "touch",
				clientX: box.left + 12,
				clientY: box.top + 8,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
	});
});
