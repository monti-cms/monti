import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command, CommandFooter, CommandInput, CommandItem, CommandList } from "../command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
