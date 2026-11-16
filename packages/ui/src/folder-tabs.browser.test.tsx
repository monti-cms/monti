import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { colourAt } from "../test/pixels";
import { render } from "../test/render";
import { FieldRow, FieldTree } from "./field-tree";
import { FolderTab, FolderTabs, FolderTabsBody, FolderTabsList } from "./folder-tabs";

it("the ring of the box under the tabs is painted over its rows: a group row with a ground does not cover it", async () => {
	render(
		<FolderTabs defaultValue="content">
			<FolderTabsList>
				<FolderTab value="content" count={2} draggable={false}>
					내용
				</FolderTab>
			</FolderTabsList>
			<FolderTabsBody value="content">
				<FieldTree>
					{/* A group's row lies on a ground from edge to edge of the box. */}
					<FieldRow group name="seo" label="검색 노출" />
					<FieldRow name="title" label="제목" kind="text" />
				</FieldTree>
			</FolderTabsBody>
		</FolderTabs>,
	);
	const body = page.getByRole("tabpanel");
	await expect.element(body).toBeVisible();
	const panel = body.element() as HTMLElement;
	const row = panel.querySelector("[data-group]") as HTMLElement;
	// A point of the ring (2px inside the box's 1px line) that the group row covers: its left edge, at the row's middle.
	const at = [2, row.getBoundingClientRect().top - panel.getBoundingClientRect().top + row.offsetHeight / 2] as const;
	expect(row.getBoundingClientRect().left - panel.getBoundingClientRect().left).toBeLessThanOrEqual(1);
	const ground = await colourAt(panel, ...at);

	await userEvent.keyboard("{Tab}{Tab}");
	await expect.element(body).toHaveFocus();
	expect(panel.matches(":focus-visible")).toBe(true);
	expect(await colourAt(panel, ...at)).not.toBe(ground);
	// The layer the ring is on takes no press: the rows under it are still pressed.
	const top = document.elementFromPoint(panel.getBoundingClientRect().left + 2, row.getBoundingClientRect().top + 4);
	expect(panel.contains(top) && top !== panel).toBe(true);
});

it("a shrunk tab with a two-digit count keeps its grip and count whole and one letter of its name before the ellipsis", async () => {
	render(
		<div style={{ width: 300 }}>
			<FolderTabs defaultValue="0">
				<FolderTabsList>
					{["아주 긴 이름의 첫 탭", "아주 긴 이름의 둘째 탭", "아주 긴 이름의 셋째 탭", "아주 긴 이름의 넷째 탭"].map(
						(name, at) => (
							<FolderTab key={name} value={String(at)} count={10 + at}>
								{name}
							</FolderTab>
						),
					)}
				</FolderTabsList>
			</FolderTabs>
		</div>,
	);
	await expect.element(page.getByRole("tab").first()).toBeVisible();
	const tabs = page.getByRole("tab").elements() as HTMLElement[];
	expect(tabs).toHaveLength(4);
	for (const tab of tabs) {
		const name = tab.querySelector<HTMLElement>(".truncate") as HTMLElement;
		expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		const letter = document.createRange();
		letter.setStart(name.firstChild as Text, 0);
		letter.setEnd(name.firstChild as Text, 1);
		expect(letter.getBoundingClientRect().right, tab.textContent ?? "").toBeLessThanOrEqual(
			name.getBoundingClientRect().right - 4,
		);
		const count = tab.querySelector("[data-slot=count]") as HTMLElement;
		expect(count.getBoundingClientRect().right).toBeLessThanOrEqual(tab.getBoundingClientRect().right);
		expect(count.scrollWidth).toBeLessThanOrEqual(count.clientWidth + 1);
	}
});
