import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { FieldRow } from "./field-tree";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxCreate,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	Count,
	Sidebar,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
} from "./index";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./internal";
import { MediaPicker } from "./media-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Tile } from "./tile";
import { TodoItem } from "./todo-item";

const LONG = "아주 길고 긴 카테고리 이름이 카드 하나의 폭보다 훨씬 더 길게 이어집니다";
const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;

describe("menu rows", () => {
	it("[PP-39] a row whose name is wider than its card is cut with an ellipsis, and the pointer on it says the name whole", async () => {
		render(
			<div style={{ width: 160 }}>
				<Combobox items={[LONG, "짧은 이름"]} defaultOpen>
					<ComboboxInput aria-label="카테고리" />
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const row = page.getByRole("option", { name: LONG });
		await expect.element(row).toBeVisible();
		const words = row.element().querySelector("[data-slot=cut-words]") as HTMLElement;
		const card = row.element().closest("[data-slot=combobox-content]") as HTMLElement;
		expect(getComputedStyle(words).textOverflow).toBe("ellipsis");
		expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);
		// Nothing runs out of the card.
		expect(words.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right);
		await userEvent.hover(words, { position: { x: 12, y: 8 } });
		await expect.poll(tip).toBe(LONG);
		// A name that fits says nothing more.
		const short = page.getByRole("option", { name: "짧은 이름" }).element();
		await userEvent.hover(short.querySelector("[data-slot=cut-words]") as HTMLElement);
		await expect.poll(tip).toBe(null);
	});

	it("[PP-33] the row that creates a value has its own mark and a rule above it, and is not drawn as a value of the list", async () => {
		render(
			<div style={{ width: 240 }}>
				<Combobox items={["봄", "new:가"]} defaultOpen>
					<ComboboxInput aria-label="태그" />
					<ComboboxContent>
						<ComboboxList>
							{(item: string) =>
								item.startsWith("new:") ? (
									<ComboboxCreate value={item}>새로 만들기: 가</ComboboxCreate>
								) : (
									<ComboboxItem value={item}>{item}</ComboboxItem>
								)
							}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const create = page.getByRole("option", { name: "새로 만들기: 가" });
		await expect.element(create).toBeVisible();
		const value = page.getByRole("option", { name: "봄" }).element();
		expect(create.element().querySelector("svg")).not.toBeNull();
		expect(value.querySelector("svg")).toBeNull();
		// It stands apart from the rows above it: a gap and the rule's own line, as a menu's groups are.
		const gap = create.element().getBoundingClientRect().top - value.getBoundingClientRect().bottom;
		expect(gap).toBeGreaterThan(7);
		const rule = getComputedStyle(create.element(), "::before");
		expect(rule.height).toBe("1px");
	});
});

describe("a field of many values", () => {
	it("[PP-06] has the open button at the end of its first line, as a field of one value does, and it stays inside the field", async () => {
		render(
			<div style={{ width: 280 }}>
				<Combobox items={["봄", "여름"]} value="봄">
					<ComboboxInput aria-label="하나" size="md" />
				</Combobox>
				<Combobox items={["봄", "여름"]} multiple value={["봄"]}>
					<ComboboxChips size="md">
						<ComboboxChip>봄</ComboboxChip>
						<ComboboxChipsInput aria-label="여럿" />
					</ComboboxChips>
				</Combobox>
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "여럿" })).toBeVisible();
		const one = page
			.getByRole("combobox", { name: "하나" })
			.element()
			.closest("[data-slot=combobox-input]") as HTMLElement;
		const many = page
			.getByRole("combobox", { name: "여럿" })
			.element()
			.closest("[data-slot=combobox-chips]") as HTMLElement;
		const opener = (box: HTMLElement) => box.querySelector("[data-slot=combobox-trigger]") as HTMLElement;
		expect(opener(one)).not.toBeNull();
		expect(opener(many)).not.toBeNull();
		const field = many.getBoundingClientRect();
		const button = opener(many).getBoundingClientRect();
		// At the right end, inside the field, and the field is as high as one of one value (the button does not make it taller).
		expect(button.right).toBeLessThanOrEqual(field.right);
		expect(field.right - button.right).toBeLessThan(12);
		expect(button.top).toBeGreaterThanOrEqual(field.top);
		expect(button.bottom).toBeLessThanOrEqual(field.bottom);
		expect(field.height).toBe(one.getBoundingClientRect().height);
		// The chevron is the same mark in both.
		expect(opener(many).querySelector("[data-slot=caret]")).not.toBeNull();
	});
});

describe("a select's value", () => {
	it("[PP-39] a value wider than the field is cut to its line, and the pointer on it says it whole", async () => {
		render(
			<div style={{ width: 160 }}>
				<Select items={[{ value: "long", label: LONG }]} defaultValue="long">
					<SelectTrigger aria-label="카테고리" width="full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="long">{LONG}</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "카테고리" })).toBeVisible();
		const value = page
			.getByRole("combobox", { name: "카테고리" })
			.element()
			.querySelector("[data-slot=select-value]") as HTMLElement;
		await expect
			.poll(() => value.scrollHeight > value.clientHeight || value.scrollWidth > value.clientWidth)
			.toBe(true);
		await userEvent.hover(value, { position: { x: 12, y: 8 } });
		await expect.poll(tip).toBe(LONG);
	});
});

describe("cut words and the keyboard", () => {
	it("[review 1] a menu row, a select row and a combobox row that the keyboard highlights says its name whole", async () => {
		render(
			<div style={{ width: 160 }}>
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>메뉴</DropdownMenuTrigger>
					<DropdownMenuContent className="w-40 max-w-40">
						<DropdownMenuItem>{LONG}</DropdownMenuItem>
						<DropdownMenuItem>다음</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>,
		);
		await expect.element(page.getByRole("menuitem", { name: LONG })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}");
		await expect.poll(tip).toBe(LONG);
		// Moving to a row that fits closes it; Escape closes the menu and what it said.
		await userEvent.keyboard("{ArrowDown}");
		await expect.poll(tip).toBe(null);
	});

	it("[review 1] a select's row says its name whole to the keyboard", async () => {
		render(
			<div style={{ width: 160 }}>
				<Select
					items={[
						{ value: "long", label: LONG },
						{ value: "short", label: "짧은" },
					]}
					defaultValue="short"
				>
					<SelectTrigger aria-label="종류" width="full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="w-40 max-w-40">
						<SelectItem value="long">{LONG}</SelectItem>
						<SelectItem value="short">짧은</SelectItem>
					</SelectContent>
				</Select>
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "종류" })).toBeVisible();
		await userEvent.click(page.getByRole("combobox", { name: "종류" }));
		await expect.element(page.getByRole("option", { name: LONG })).toBeVisible();
		await userEvent.keyboard("{ArrowUp}");
		await expect.poll(tip).toBe(LONG);
	});

	it("[review 1] a combobox row says its name whole while the input keeps the focus", async () => {
		render(
			<div style={{ width: 160 }}>
				<Combobox items={[LONG, "짧은 이름"]}>
					<ComboboxInput aria-label="카테고리" />
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const input = page.getByRole("combobox", { name: "카테고리" });
		await expect.element(input).toBeVisible();
		await userEvent.click(input);
		await userEvent.keyboard("{ArrowDown}");
		await expect.element(page.getByRole("option", { name: LONG })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}");
		await expect.poll(tip).toBe(LONG);
		expect(document.activeElement).toBe(input.element());
	});

	it("[review 2] a menu row with a caption cuts its name with an ellipsis, in its own line", async () => {
		render(
			<div style={{ width: 160 }}>
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>메뉴</DropdownMenuTrigger>
					<DropdownMenuContent className="w-40 max-w-40">
						<DropdownMenuItem caption="한국어 원문은 그대로">{LONG}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>,
		);
		const row = page.getByRole("menuitem");
		await expect.element(row).toBeVisible();
		const words = row.element().querySelector("[data-slot=cut-words]") as HTMLElement;
		expect(getComputedStyle(words).textOverflow).toBe("ellipsis");
		expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);
		expect(words.getBoundingClientRect().right).toBeLessThanOrEqual(row.element().getBoundingClientRect().right);
	});

	it("[review 2] a tile that holds a cut name and a cut detail says one thing to the keyboard, not two", async () => {
		render(
			<div style={{ width: 120 }}>
				<Tile preview={null} title={LONG} detail={LONG} onClick={() => {}} />
			</div>,
		);
		const tile = page.getByRole("button");
		await expect.element(tile).toBeVisible();
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(tile.element());
		await expect.poll(tip).toBe(LONG);
		expect(document.querySelectorAll('[data-slot="tooltip-content"]').length).toBe(1);
	});

	it("[review 2] the words of a to-do row that goes somewhere find the pointer above its cover layer, and a title with no tag wraps", async () => {
		render(
			<div style={{ width: 200 }}>
				<TodoItem title={LONG} detail={LONG} onOpen={() => {}} />
				<TodoItem title="짧은 제목" tag="변경" detail={LONG} onOpen={() => {}} />
			</div>,
		);
		await expect.element(page.getByText("짧은 제목")).toBeVisible();
		const rows = [...document.querySelectorAll<HTMLElement>("[data-slot=todo-item]")];
		const title = rows[0]?.querySelector("button > [data-slot=cut-words]") as HTMLElement;
		// No tag: the title is whole, over lines.
		expect(getComputedStyle(title).textOverflow).not.toBe("ellipsis");
		expect(title.getBoundingClientRect().height).toBeGreaterThan(30);
		// The detail line is cut, and the pointer on it, over the button's own cover, says it whole.
		const detail = rows[0]?.querySelectorAll("button > [data-slot=cut-words]")[1] as HTMLElement;
		expect(detail.scrollWidth).toBeGreaterThan(detail.clientWidth);
		await userEvent.hover(detail, { position: { x: 12, y: 6 } });
		await expect.poll(tip).toBe(LONG);
	});
});

describe("a field of many values with many chips", () => {
	it("[review 1] keeps the open button at the first line's end when the chips wrap, inside the field", async () => {
		const names = Array.from({ length: 14 }, (_, index) => `태그 ${index + 1}`);
		render(
			<div style={{ width: 280 }}>
				<Combobox items={names} multiple value={names}>
					<ComboboxChips size="md">
						{names.map((name) => (
							<ComboboxChip key={name}>{name}</ComboboxChip>
						))}
						<ComboboxChipsInput aria-label="태그들" />
					</ComboboxChips>
				</Combobox>
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "태그들" })).toBeVisible();
		const field = page
			.getByRole("combobox", { name: "태그들" })
			.element()
			.closest("[data-slot=combobox-chips]") as HTMLElement;
		const opener = field.querySelector("[data-slot=combobox-trigger]") as HTMLElement;
		const box = field.getBoundingClientRect();
		// The chips wrapped to more than one line.
		expect(box.height).toBeGreaterThan(70);
		const button = opener.getBoundingClientRect();
		expect(button.top - box.top).toBeLessThan(32);
		expect(box.right - button.right).toBeLessThan(12);
		// No chip stands under it.
		for (const chip of field.querySelectorAll("[data-slot=combobox-chip]"))
			expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(button.left + 1);
	});
});

describe("the media picker's path", () => {
	it("[review 1] the open folder's name stays the current page of the path while it is cut", async () => {
		render(
			<MediaPicker
				open
				onOpenChange={() => {}}
				title="이미지 넣기"
				topLabel="미디어"
				folders={[{ id: "a", name: LONG, depth: 0 }]}
				folder="a"
				onFolderChange={() => {}}
				pathLabel="경로"
				search=""
				onSearchChange={() => {}}
				searchLabel="검색"
				uploadLabel="올리기"
				onUpload={() => {}}
				confirmLabel="넣기"
				onConfirm={() => {}}
			/>,
		);
		const current = page.getByRole("navigation", { name: "경로" });
		await expect.element(current).toBeVisible();
		expect(current.element().querySelector('[aria-current="page"]')?.textContent).toBe(LONG);
	});
});

describe("a schema field's line", () => {
	it("[review 2] its cut label finds the pointer above the line's cover layer, says itself whole, and a press on it still opens the field", async () => {
		let opened = 0;
		render(
			<ul style={{ width: 420 }}>
				<FieldRow name="summary" label={LONG} kind="text" onOpen={() => opened++} openLabel="summary 열기" />
			</ul>,
		);
		await expect.element(page.getByRole("button", { name: "summary 열기" })).toBeVisible();
		const label = document.querySelector("[data-slot=field-row] [data-slot=cut-words]") as HTMLElement;
		expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
		await userEvent.hover(label, { position: { x: 12, y: 6 } });
		await expect.poll(tip).toBe(LONG);
		await userEvent.click(label, { position: { x: 12, y: 6 } });
		expect(opened).toBe(1);
	});
});

describe("the sidebar's rows", () => {
	it("[review 2] a folder row whose name is cut says the name alone, not the name with its count stuck on", async () => {
		render(
			<SidebarProvider rail={false} onRailChange={() => {}}>
				<Sidebar label="관리자 메뉴">
					<SidebarMenuSub aria-label="폴더">
						<li>
							<SidebarMenuSubButton render={<button type="button" />}>
								<span>{LONG}</span>
								<Count>12</Count>
							</SidebarMenuSubButton>
						</li>
					</SidebarMenuSub>
				</Sidebar>
			</SidebarProvider>,
		);
		const row = page.getByRole("button", { name: /아주 길고/ });
		await expect.element(row).toBeVisible();
		await userEvent.hover(row.element().querySelector("span") as HTMLElement, { position: { x: 12, y: 6 } });
		await expect.poll(tip).toBe(LONG);
	});
});
