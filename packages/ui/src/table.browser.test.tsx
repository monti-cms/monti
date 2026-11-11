import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
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

/** What is on top at the middle of an element: what a pointer there finds. */
const onTop = (element: Element) => {
	const box = element.getBoundingClientRect();
	return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
};

function rows(opened: (held: { meta: boolean }) => void, rowPressed?: () => void) {
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
											opened({ meta: event.metaKey });
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
		expect(onTop(page.getByText("개발").element())?.closest("[title]")?.getAttribute("title")).toBe("개발");
		expect(onTop(page.getByText("/posts/first-post").element())?.getAttribute("title")).toBe("/posts/first-post");
		expect(onTop(page.getByText("KO +2").element())?.closest("[data-slot=locale-codes]")).not.toBeNull();
	});

	it("a press on them opens the row once, with the keys held; the middle button opens its address in a new tab; a control keeps its own press", async () => {
		const opened = vi.fn();
		const rowPressed = vi.fn();
		const tab = vi.spyOn(window, "open").mockReturnValue(null);
		render(rows(opened, rowPressed));
		await userEvent.click(page.getByText("개발"));
		expect(opened).toHaveBeenCalledTimes(1);
		expect(rowPressed).toHaveBeenCalledTimes(1);
		await userEvent.click(page.getByText("KO +2"));
		expect(opened).toHaveBeenCalledTimes(2);
		expect(opened).toHaveBeenLastCalledWith({ meta: false });
		// A key held with the press (a new tab) reaches the link with it.
		await userEvent.click(page.getByText("개발"), { modifiers: ["Meta"] });
		expect(opened).toHaveBeenLastCalledWith({ meta: true });
		opened.mockClear();
		opened.mockImplementation(() => {});

		await userEvent.click(page.getByText("개발"), { button: "middle" });
		expect(tab).toHaveBeenCalledTimes(1);
		expect(String(tab.mock.calls[0]?.[0])).toMatch(/#\/first$/);
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
		tab.mockRestore();
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

	it("a row that opens a panel has no address: the middle button there is left to the browser", async () => {
		const tab = vi.spyOn(window, "open").mockReturnValue(null);
		render(
			<Table container="none" layout="fixed" columns={[undefined, 84]}>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							<RowTitle title={<RowLink render={<button type="button" />}>임시</RowLink>} />
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
		await userEvent.click(page.getByText("태그"), { button: "middle" });
		expect(tab).not.toHaveBeenCalled();
		tab.mockRestore();
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
});
