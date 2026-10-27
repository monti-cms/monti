import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command, CommandFooter, CommandInput, CommandItem, CommandList } from "../command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import { MenuShortcut, MenuValue } from "../menu-parts";
import { SheetList } from "../sheet-list";
import { TodoDone, TodoItem } from "../todo-item";

afterEach(cleanup);

describe("menus", () => {
	it("marks the current value of a pick-one list with a ✓ and gives it no background", async () => {
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup value="title">
						<DropdownMenuRadioItem value="recent">최근 수정순</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="title">제목순</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		const items = await screen.findAllByRole("menuitemradio");
		expect(items[1]?.querySelector("[data-slot=menu-tick]")).not.toBeNull();
		expect(items[0]?.querySelector("[data-slot=menu-tick]")).toBeNull();
		expect(items[1]?.className).not.toMatch(/(^|\s)bg-monti-selected/);
	});

	it("shows a row's current value before its ›, and opens the second level with → and closes it with ←", async () => {
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
		expect(trigger.querySelector("[data-slot=menu-value]")?.nextElementSibling?.tagName.toLowerCase()).toBe("svg");
		expect(screen.queryByText("수정한 날")).toBeNull();
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowRight" });
		await screen.findByText("수정한 날");
		const sub = await screen.findByRole("menuitem", { name: "수정한 날" });
		sub.focus();
		fireEvent.keyDown(sub, { key: "ArrowLeft" });
		await waitFor(() => expect(screen.queryByText("수정한 날")).toBeNull());
	});

	it("keeps the danger and disabled looks on the row itself", async () => {
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem variant="danger">삭제</DropdownMenuItem>
					<DropdownMenuItem disabled>
						보관<MenuShortcut>쓰는 중</MenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		expect((await screen.findByRole("menuitem", { name: "삭제" })).getAttribute("data-variant")).toBe("danger");
		expect(screen.getByRole("menuitem", { name: /보관/ }).hasAttribute("data-disabled")).toBe(true);
	});

	it("filters a searchable list as you type, marks the checked row and keeps the footer row", () => {
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
		expect(screen.getByText("리액트").closest("[cmdk-item]")?.querySelector("[data-slot=menu-tick]")).not.toBeNull();
		fireEvent.change(screen.getByPlaceholderText("태그 찾기"), { target: { value: "css" } });
		expect(screen.queryByText("리액트")).toBeNull();
		expect(screen.getByText("CSS")).toBeTruthy();
	});
});

describe("SheetList", () => {
	it("opens upward with the group's name and count, runs a row's action, and shows what is done", async () => {
		const onAction = vi.fn();
		render(
			<SheetList trigger={<button type="button">고칠 것 2</button>} label="고칠 것" count={2} defaultOpen>
				<TodoItem blocking title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={onAction} />
				<TodoDone>요약 확인함</TodoDone>
			</SheetList>,
		);
		const sheet = await screen.findByText("제목이 비어 있어요");
		expect(sheet.closest("[data-slot=sheet-list]")?.querySelector("[data-slot=sheet-list-head]")?.textContent).toBe(
			"고칠 것2",
		);
		expect(document.querySelector("[data-slot=todo-mark]")?.getAttribute("data-blocking")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "이동" }));
		expect(onAction).toHaveBeenCalledOnce();
		expect(screen.getByText("요약 확인함")).toBeTruthy();
	});
});
