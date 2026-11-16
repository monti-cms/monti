import * as React from "react";
import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { BulkBar } from "./bulk-bar";
import { CutWords } from "./cut-words";
import { DropdownMenuItem } from "./dropdown-menu";
import { ListHead } from "./list-head";
import { Table, TableBody, TableCell, TableRow } from "./table";

it("letting go of the picked rows is a quiet text button at the bar's end, not a pill (components/list.md, bulk bar)", async () => {
	render(
		<BulkBar
			label="2개 선택"
			selectAll={{ state: "some", onChange: () => {}, label: "모두 선택" }}
			clearLabel="선택 해제"
			onClear={() => {}}
		/>,
	);
	const clear = page.getByRole("button", { name: "선택 해제" });
	await expect.element(clear).toBeVisible();
	const element = clear.element() as HTMLElement;
	expect(element.dataset.slot).not.toBe("button");
	const style = getComputedStyle(element);
	expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
	expect(style.paddingLeft).toBe("0px");
});

it("Esc lets go of the pick, unless the focus is in a field, a menu or a dialog", async () => {
	let cleared = 0;
	render(
		<>
			<BulkBar label="2개 선택" clearLabel="선택 해제" onClear={() => cleared++} />
			<input aria-label="찾기" />
			<div role="dialog" aria-label="창">
				<button type="button">안</button>
			</div>
		</>,
	);
	const press = (target: Element) =>
		target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
	await expect.element(page.getByRole("button", { name: "선택 해제" })).toBeVisible();
	press(document.body);
	expect(cleared).toBe(1);
	press(page.getByRole("textbox", { name: "찾기" }).element());
	press(page.getByRole("button", { name: "안" }).element());
	expect(cleared).toBe(1);
	press(page.getByRole("button", { name: "선택 해제" }).element());
	expect(cleared).toBe(2);
});

function Picking() {
	const [picked, setPicked] = React.useState(true);
	return (
		<Table container="none" layout="fixed" columns={[120, undefined, 48]}>
			{picked ? (
				<BulkBar label="1개 선택" clearLabel="선택 해제" onClear={() => setPicked(false)} colSpan={3}>
					<button type="button">휴지통으로</button>
				</BulkBar>
			) : (
				<ListHead
					columns={[{ id: "title", label: "제목", menu: <DropdownMenuItem>정렬</DropdownMenuItem> }]}
					end={48}
				/>
			)}
			<TableBody>
				<TableRow>
					<TableCell>글</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}

it("Esc with the focus on an action of the bar hands the focus to the head that comes back, not to the page", async () => {
	render(<Picking />);
	const action = page.getByRole("button", { name: "휴지통으로" });
	await expect.element(action).toBeVisible();
	(action.element() as HTMLElement).focus();
	await userEvent.keyboard("{Escape}");
	await expect.element(page.getByRole("button", { name: "제목" })).toBeVisible();
	await expect.poll(() => document.activeElement).toBe(page.getByRole("button", { name: "제목" }).element());
});

it("Esc in an open menu of the bar closes the menu and keeps the pick", async () => {
	let cleared = 0;
	render(
		<BulkBar
			label="1개 선택"
			clearLabel="선택 해제"
			onClear={() => cleared++}
			more={{ label: "더 보기", children: <DropdownMenuItem>내보내기</DropdownMenuItem> }}
		/>,
	);
	await userEvent.click(page.getByRole("button", { name: "더 보기" }));
	await expect.element(page.getByRole("menuitem", { name: "내보내기" })).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.element(page.getByRole("menuitem", { name: "내보내기" })).not.toBeInTheDocument();
	expect(cleared).toBe(0);
});

it("Esc on a button in a panel beside the list is the panel's, not the pick's", async () => {
	let cleared = 0;
	render(
		<>
			<BulkBar label="1개 선택" clearLabel="선택 해제" onClear={() => cleared++} />
			<aside data-slot="side-panel">
				<button type="button">패널 단추</button>
			</aside>
		</>,
	);
	const inside = page.getByRole("button", { name: "패널 단추" });
	await expect.element(inside).toBeVisible();
	(inside.element() as HTMLElement).focus();
	await userEvent.keyboard("{Escape}");
	expect(cleared).toBe(0);
});

it("an Esc that closes the words of a cut name is spent: it does not let go of the pick too", async () => {
	let cleared = 0;
	render(
		<>
			<BulkBar label="1개 선택" clearLabel="선택 해제" onClear={() => cleared++} />
			<div style={{ width: 40 }}>
				<CutWords className="block truncate" whole="아주 긴 이름의 글 제목입니다">
					아주 긴 이름의 글 제목입니다
				</CutWords>
			</div>
		</>,
	);
	await userEvent.hover(page.getByText("아주 긴 이름의 글 제목입니다").first());
	await expect.element(page.getByRole("tooltip")).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.element(page.getByRole("tooltip")).not.toBeInTheDocument();
	expect(cleared).toBe(0);
	await userEvent.keyboard("{Escape}");
	expect(cleared).toBe(1);
});
