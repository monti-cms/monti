import { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, dropDrag, middleOf, onTopOf, pointerPath, wholeUnderPointer } from "../../../testing/input";
import { render } from "../test/render";
import {
	FileUseRow,
	ListHead,
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
	TableHead,
	TableHeader,
	TableRow,
	Text,
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
		expect(wholeUnderPointer(page.getByText("개발").element())).toBe("개발");
		expect(wholeUnderPointer(page.getByText("/posts/first-post").element())).toBe("/posts/first-post");
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

	it("with words after the address, the box of both cuts as an address alone does (T127): a letter and its … or off the line, the title whole while it fits; the address is mono and the words sans", async () => {
		const host = render(
			<Table container="none" layout="fixed">
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle
								title={<RowLink href="#">CMS elements: details</RowLink>}
								address="post/cms-elements-details"
								note="명령줄 · 되돌림 10:44"
							/>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		await expect.element(page.getByText("CMS elements: details")).toBeVisible();
		const title = page.getByText("CMS elements: details").element().closest(".truncate") as HTMLElement;
		const address = host.querySelector("[data-slot=row-title-address]") as HTMLElement;
		const note = host.querySelector("[data-slot=row-title-note]") as HTMLElement;
		expect(getComputedStyle(address).fontFamily).toMatch(/mono/i);
		expect(getComputedStyle(note).fontFamily).not.toMatch(/mono/i);
		const box = address.parentElement as HTMLElement;
		const line = box.parentElement as HTMLElement;
		const wide = (node: HTMLElement) => {
			const all = document.createRange();
			all.selectNodeContents(node);
			return all.getBoundingClientRect().width;
		};
		// A letter and its "…" in the address's own letters: less than this is a letter cut through.
		const least = address.cloneNode(false) as HTMLElement;
		least.textContent = "p…";
		least.style.cssText = "position:absolute";
		line.append(least);
		const letter = least.getBoundingClientRect().width;
		least.remove();
		const seen = { shown: 0, gone: 0, whole: 0, cut: 0 };
		for (let width = 420; width >= 60; width--) {
			host.style.width = `${width}px`;
			const room = line.getBoundingClientRect();
			const at = `at ${width}px`;
			if (box.getBoundingClientRect().top < room.bottom - 1) {
				seen.shown++;
				expect(box.getBoundingClientRect().width, at).toBeGreaterThanOrEqual(letter - 0.01);
				expect(box.getBoundingClientRect().right, at).toBeLessThanOrEqual(room.right + 0.01);
			} else seen.gone++;
			if (wide(title) <= room.width + 0.01) {
				seen.whole++;
				expect(title.getBoundingClientRect().width, at).toBeGreaterThanOrEqual(wide(title) - 0.01);
			} else seen.cut++;
			expect(title.getBoundingClientRect().right, at).toBeLessThanOrEqual(room.right + 0.01);
		}
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
		// How long the tooltip is waited for. CI failed here three times (#468, #470, #478) on the first open, the last time with these five
		// seconds, and never on a developer's machine (nor under load there): the tooltip did not open at all. It opens when a pointer's move
		// reaches words that are cut, so the test now waits on each of those by name before it looks for the tooltip: the next failure says
		// which did not hold.
		const shown = { timeout: 5000 };
		/** The box the words are cut in. */
		await expect.element(page.getByRole("link", { name: long })).toBeVisible();
		const title = page.getByRole("link", { name: long }).element();
		const cutBox = title.closest<HTMLElement>(".truncate") as HTMLElement;
		const cut = () => {
			const all = document.createRange();
			all.selectNodeContents(cutBox);
			return all.getBoundingClientRect().width > cutBox.getBoundingClientRect().width + 0.01;
		};
		/** The pointer's moves that reached the words. */
		let reached = 0;
		const count = (event: PointerEvent) => {
			if (event.target instanceof Node && cutBox.contains(event.target)) reached += 1;
		};
		document.addEventListener("pointermove", count, true);
		onTestFinished(() => document.removeEventListener("pointermove", count, true));
		/**
		 * Points at the words as a hand does: the pointer comes along their line to a place near their start (the words run on under the
		 * cut, past where they show), in several moves and not in one jump. One jump is one move, and whatever that one move misses is never
		 * made up for while the pointer rests.
		 */
		const pointAtWords = async (x = 12, y = 8) => {
			const box = title.getBoundingClientRect();
			const before = reached;
			await pointerPath(
				[
					{ x: box.left + x + 60, y: box.top + y },
					{ x: box.left + x, y: box.top + y },
				],
				{ steps: 5 },
			);
			await expect.poll(() => reached, shown).toBeGreaterThan(before);
		};
		await expect.poll(cut, shown).toBe(true);
		await pointAtWords();
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
		await pointAtWords();
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

	it("[dragging] [dropped] an edge dragged before the title's width was ever measured still moves: the drag starts from the width laid out at the press", async () => {
		// The observer that tells the head its title's width never speaks: as on a page too busy to have run it yet, or after a change of
		// layout it has not told of. The press comes all the same.
		const Observer = window.ResizeObserver;
		window.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		} as typeof ResizeObserver;
		onTestFinished(() => {
			window.ResizeObserver = Observer;
		});
		function Head() {
			const [kind, setKind] = useState(84);
			const columns = [
				{ id: "title", label: "제목" },
				{ id: "kind", label: "종류", size: kind, kindSize: 84 },
			];
			return (
				<Table container="none" layout="fixed" columns={[undefined, kind, 48]}>
					<ListHead
						columns={columns}
						end={48}
						onResize={(changes) => typeof changes.kind === "number" && setKind(changes.kind)}
						resizeLabel={(label) => `${label} 열 너비 조절`}
					/>
					<TableBody>
						<TableRow>
							<TableCell>첫 번째 글</TableCell>
							<TableCell>게시글</TableCell>
							<TableCell />
						</TableRow>
					</TableBody>
				</Table>
			);
		}
		render(<Head />);
		const edge = page.getByRole("separator", { name: "제목 열 너비 조절" });
		await expect.element(edge).toBeVisible();
		const rights = () => [...document.querySelectorAll("th")].map((th) => Math.round(th.getBoundingClientRect().right));
		const before = rights();
		const from = middleOf(edge.element());
		await dragPath([from, { x: from.x - 40, y: from.y }], { hold: true });
		const moved = [(before[0] as number) - 40, ...before.slice(1)];
		await expect.poll(rights).toEqual(moved);
		await dropDrag();
		await expect.poll(rights).toEqual(moved);
		// The keys start from the same width: End takes the title to its widest, where the kind is at its narrowest; an arrow gives a step
		// back; Home takes the title to its narrowest (200px), where the kind has the rest, up to its widest (480px).
		edge.element().focus();
		const width = (nth: number) => Math.round(document.querySelectorAll("th")[nth]?.getBoundingClientRect().width ?? 0);
		const kind = () => width(1);
		const both = width(0) + width(1);
		await userEvent.keyboard("{End}");
		await expect.poll(kind).toBe(60);
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(kind).toBe(76);
		await userEvent.keyboard("{Home}");
		await expect.poll(kind).toBe(Math.min(480, both - 200));
		expect(width(0)).toBe(both - kind());
	});

	it("a title already narrower than its least (a narrow window): a press that cannot move the edge changes nothing, and the edge still goes the way it can", async () => {
		const resized = vi.fn();
		function Head() {
			const [kind, setKind] = useState(84);
			return (
				// 300px: the title has 168 of them, under its 200.
				<div className="w-[300px]">
					<Table container="none" layout="fixed" columns={[undefined, kind, 48]}>
						<ListHead
							columns={[
								{ id: "title", label: "제목" },
								{ id: "kind", label: "종류", size: kind, kindSize: 84 },
							]}
							end={48}
							onResize={(changes) => {
								resized(changes);
								if (changes.kind !== undefined) setKind(changes.kind ?? 84);
							}}
							resizeLabel={(label) => `${label} 열 너비 조절`}
						/>
						<TableBody>
							<TableRow>
								<TableCell>첫 번째 글</TableCell>
								<TableCell>게시글</TableCell>
								<TableCell />
							</TableRow>
						</TableBody>
					</Table>
				</div>
			);
		}
		render(<Head />);
		const edge = page.getByRole("separator", { name: "제목 열 너비 조절" });
		await expect.element(edge).toBeVisible();
		const width = (nth: number) => Math.round(document.querySelectorAll("th")[nth]?.getBoundingClientRect().width ?? 0);
		expect(width(0)).toBeLessThan(200);
		const [title, kind] = [width(0), width(1)];
		const unchanged = async () => {
			// Whatever was reported, no width is other than it was.
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect([width(0), width(1)]).toEqual([title, kind]);
		};
		// A press with no movement.
		await userEvent.click(edge);
		await unchanged();
		// The ways that would narrow the title further: an arrow, and Home.
		edge.element().focus();
		await userEvent.keyboard("{ArrowLeft}");
		await unchanged();
		await userEvent.keyboard("{Home}");
		await unchanged();
		// Dragged toward the title: the same.
		const from = middleOf(edge.element());
		await dragPath([from, { x: from.x - 30, y: from.y }]);
		await unchanged();
		// The way it can go: the title widens by a step, and End takes the kind to its narrowest.
		await userEvent.keyboard("{ArrowRight}");
		await expect.poll(() => width(1)).toBe(kind - 16);
		await userEvent.keyboard("{End}");
		await expect.poll(() => width(1)).toBe(60);
		expect(width(0)).toBe(title + kind - 60);
	});
});

describe("A cut cell", () => {
	it("says its value whole in the tooltip every cut text has, while it is cut and not when it fits", async () => {
		const value = "프런트엔드 개발 이야기";
		const table = (width: number) => (
			<Table container="none" layout="fixed" columns={[200, width, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/first">첫 번째 글</RowLink>} />
						</TableCell>
						<TableCell tone="subtle" truncate title={value}>
							{value}
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>
		);
		// The words' own box in the cell.
		const words = () => page.getByRole("cell", { name: value }).getByText(value);
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		const host = render(table(72));
		// Over the row's link, so the pointer finds the words; no `title` of the browser's is left on the cell.
		await userEvent.hover(words(), { position: { x: 6, y: 6 } });
		await expect.poll(tip, { timeout: 5000 }).toBe(value);
		expect(document.querySelector("td[title]")).toBeNull();
		await userEvent.hover(page.getByText("첫 번째 글"));
		await expect.poll(tip).toBe(null);
		host.remove();
		render(table(240));
		await userEvent.hover(words(), { position: { x: 6, y: 6 } });
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(tip()).toBe(null);
	});
});

describe("A cut cell that holds the row's check", () => {
	it("is not cut by the check that hangs outside it: a value that fits says nothing", async () => {
		render(
			<Table container="none" layout="fixed" columns={[160, undefined]}>
				<TableBody>
					<TableRow>
						<TableCell truncate title="draft">
							<RowCheck checked={false} onCheckedChange={() => {}} label="pick" />
							draft
						</TableCell>
						<TableCell truncate>
							<RowTitle title={<RowLink href="#/first">first</RowLink>} />
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		await userEvent.hover(page.getByRole("cell", { name: "draft" }).getByText("draft"), { position: { x: 4, y: 4 } });
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(tip()).toBe(null);
	});
});

describe("A row the keyboard comes to at a scrolled edge (T190)", () => {
	const list = (
		// A box that scrolls its rows under the table's stuck header, as the page does, with the 8px every scrolling box keeps.
		<div data-testid="scroll" style={{ height: 240, overflowY: "auto", scrollPaddingBlock: 8 }}>
			<Table container="none">
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 24 }, (_, index) => (
						<TableRow key={index}>
							<TableCell>
								<RowTitle title={<RowLink href={`#/${index}`}>{`글 ${index + 1}`}</RowLink>} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
	const edges = () => {
		const link = document.activeElement as HTMLElement;
		const row = (link.closest("tr") as HTMLElement).getBoundingClientRect();
		const box = page.getByTestId("scroll").element().getBoundingClientRect();
		const head = (document.querySelector("thead th") as HTMLElement).getBoundingClientRect();
		return { link: link.textContent, above: row.top - head.bottom, below: box.bottom - row.bottom };
	};

	it("going down, the whole row is in the box, its ring's lower side too; going up, the row is out from under the stuck header", async () => {
		render(list);
		await expect.element(page.getByRole("link", { name: "글 1", exact: true })).toBeVisible();
		// Down past the fold, one row at a time.
		for (let index = 0; index < 12; index++) {
			await userEvent.keyboard("{Tab}");
			const at = edges();
			expect(at.link).toBe(`글 ${index + 1}`);
			expect(at.below, `row ${index + 1}, going down`).toBeGreaterThanOrEqual(0);
			expect(at.above, `row ${index + 1}, going down`).toBeGreaterThanOrEqual(0);
		}
		// And back up: each row the keyboard comes to stands whole under the header.
		for (let index = 10; index >= 0; index--) {
			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			const at = edges();
			expect(at.link).toBe(`글 ${index + 1}`);
			expect(at.above, `row ${index + 1}, going up`).toBeGreaterThanOrEqual(0);
			expect(at.below, `row ${index + 1}, going up`).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("Cut words inside a link", () => {
	it("are said when the keyboard comes to the link that holds them", async () => {
		const long = "A very long title of an entry that uses this file and does not fit";
		render(
			// A file's use row: the title is a link that holds its cut words.
			<div style={{ width: 200 }}>
				<FileUseRow title={long} places="본문" href="#/entry" />
			</div>,
		);
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		await expect.element(page.getByRole("link")).toBeVisible();
		await userEvent.keyboard("{Tab}");
		await expect.element(page.getByRole("link")).toHaveFocus();
		await expect.poll(tip, { timeout: 5000 }).toBe(long);
		(document.activeElement as HTMLElement).blur();
		await expect.poll(tip).toBe(null);
	});
});

describe("A cut line under a row's title", () => {
	it("stands over the row's link: the pointer finds it, it says itself whole, and a press on it still opens the row", async () => {
		const opened = vi.fn();
		const line = "First section · Second section · Third section · Fourth section · Fifth section";
		render(
			<Table container="none" layout="fixed" columns={[220, undefined]}>
				<TableBody>
					<TableRow twoLine>
						<TableCell truncate>
							<Text as="div" truncate>
								<RowLink render={<button type="button" onClick={opened} />}>Weekly note</RowLink>
							</Text>
							<Text as="div" variant="note" tone="subtle" truncate>
								{line}
							</Text>
						</TableCell>
						<TableCell />
					</TableRow>
				</TableBody>
			</Table>,
		);
		const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
		await expect.element(page.getByText(line)).toBeVisible();
		const words = page.getByText(line).element();
		expect(onTopOf(words)).toBe(words);
		const box = words.getBoundingClientRect();
		await pointerPath(
			[
				{ x: box.left + 70, y: box.top + box.height / 2 },
				{ x: box.left + 10, y: box.top + box.height / 2 },
			],
			{ steps: 5 },
		);
		await expect.poll(tip, { timeout: 5000 }).toBe(line);
		await userEvent.click(page.getByText(line).first(), { position: { x: 10, y: 4 } });
		expect(opened).toHaveBeenCalledTimes(1);
		// The title's own words hold the link: their layer is still the whole row's.
		const link = page.getByRole("button", { name: "Weekly note" }).element();
		expect(getComputedStyle(link.parentElement as HTMLElement).position).toBe("static");
	});
});
