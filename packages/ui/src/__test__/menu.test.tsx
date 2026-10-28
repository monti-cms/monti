import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command, CommandFooter, CommandInput, CommandItem, CommandList } from "../command";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSearch,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import { MenuValue } from "../menu-parts";

afterEach(cleanup);

describe("menus", () => {
	it("opens the second level with → and closes it with ←", async () => {
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							정렬<MenuValue>수정한 날 · 최신순</MenuValue>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>수정한 날</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		const trigger = await screen.findByRole("menuitem", { name: /정렬/ });
		expect(screen.queryByText("수정한 날")).toBeNull();
		act(() => trigger.focus());
		fireEvent.keyDown(trigger, { key: "ArrowRight" });
		await screen.findByText("수정한 날");
		const sub = await screen.findByRole("menuitem", { name: "수정한 날" });
		act(() => sub.focus());
		fireEvent.keyDown(sub, { key: "ArrowLeft" });
		await waitFor(() => expect(screen.queryByText("수정한 날")).toBeNull());
	});

	it("filters a searchable list as you type, and lets the footer action be picked", () => {
		const onCreate = vi.fn();
		render(
			<Command>
				<CommandInput placeholder="태그 찾기" />
				<CommandList>
					<CommandItem value="리액트" checked>
						리액트
					</CommandItem>
					<CommandItem value="CSS">CSS</CommandItem>
				</CommandList>
				<CommandFooter>
					<CommandItem value="새 태그" onSelect={onCreate}>
						새 태그 만들기
					</CommandItem>
				</CommandFooter>
			</Command>,
		);
		fireEvent.change(screen.getByPlaceholderText("태그 찾기"), { target: { value: "css" } });
		expect(screen.queryByText("리액트")).toBeNull();
		expect(screen.getByText("CSS")).toBeTruthy();
		// The footer action is found by what it says, like the rows above it.
		fireEvent.change(screen.getByPlaceholderText("태그 찾기"), { target: { value: "새 태그" } });
		fireEvent.click(screen.getByText("새 태그 만들기"));
		expect(onCreate).toHaveBeenCalledOnce();
	});
});

describe("rows with a box", () => {
	it("are on or off with a click, and say so to screen readers", async () => {
		const onChange = vi.fn();
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuCheckboxItem box checked={false} onCheckedChange={onChange}>
						리액트
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem box checked>
						회고
					</DropdownMenuCheckboxItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		const off = await screen.findByRole("menuitemcheckbox", { name: "리액트" });
		expect(off.getAttribute("aria-checked")).toBe("false");
		expect((await screen.findByRole("menuitemcheckbox", { name: "회고" })).getAttribute("aria-checked")).toBe("true");
		fireEvent.click(off);
		expect(onChange).toHaveBeenCalledWith(true, expect.anything());
	});
});

describe("the search row of a menu", () => {
	it("reports what is typed, and keeps the keys a text needs from the menu around it", async () => {
		const onValueChange = vi.fn();
		const outside = vi.fn();
		render(
			// biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for whatever sits above the menu, to see what reaches it
			<div onKeyDown={outside}>
				<DropdownMenu defaultOpen>
					<DropdownMenuTrigger>open</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuSearch label="태그 찾기" value="" onValueChange={onValueChange} />
						<DropdownMenuItem>리액트</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>,
		);
		const field = await screen.findByRole("textbox", { name: "태그 찾기" });
		fireEvent.change(field, { target: { value: "리" } });
		expect(onValueChange).toHaveBeenCalledWith("리");
		fireEvent.keyDown(field, { key: "ArrowRight" });
		fireEvent.keyDown(field, { key: "a" });
		expect(outside).not.toHaveBeenCalled();
	});
});

describe("a pick-one list", () => {
	it("applies the value picked and closes the whole menu", async () => {
		const onValueChange = vi.fn();
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup value="recent" onValueChange={onValueChange}>
						<DropdownMenuRadioItem value="recent">최근 수정</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="title">제목 오름차순</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "제목 오름차순" }));
		expect(onValueChange).toHaveBeenCalledWith("title", expect.anything());
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	});
});
