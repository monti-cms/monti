import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import {
	Button,
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "./index";

const ROWS = Array.from({ length: 30 }, (_, at) => `태그 ${at + 1}`);

/** Whether the highlighted row is wholly inside the part of the list that shows. */
function highlightInView() {
	const row = page.getByRole("option", { selected: true }).element().getBoundingClientRect();
	const list = page.getByRole("listbox").element().getBoundingClientRect();
	return row.top >= list.top - 1 && row.bottom <= list.bottom + 1;
}

describe("Command", () => {
	it("[keys-to-end] the arrow keys take the highlight to the last row and back, the row always in view; Enter picks it", async () => {
		const picked = vi.fn();
		render(
			<Popover open>
				<PopoverContent width="sm" padding="menu">
					<Command>
						<CommandInput placeholder="태그 찾기" />
						<CommandList aria-label="태그">
							<CommandGroup heading="태그">
								{ROWS.map((row) => (
									<CommandItem key={row} onSelect={() => picked(row)}>
										{row}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>,
		);
		await userEvent.click(page.getByPlaceholder("태그 찾기"));
		await expect
			.element(page.getByRole("option", { name: "태그 1", exact: true }))
			.toHaveAttribute("aria-selected", "true");
		for (const row of ROWS.slice(1)) {
			await userEvent.keyboard("{ArrowDown}");
			await expect.element(page.getByRole("option", { selected: true })).toHaveTextContent(row);
			await expect.poll(highlightInView).toBe(true);
		}
		for (const _ of ROWS.slice(1)) await userEvent.keyboard("{ArrowUp}");
		await expect.element(page.getByRole("option", { selected: true })).toHaveTextContent("태그 1");
		await expect.poll(highlightInView).toBe(true);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
		expect(picked).toHaveBeenCalledWith("태그 3");
	});

	it("[many] [esc-closes] thirty rows opened from a button: the list scrolls inside the window, and Esc closes it with nothing picked, the focus back on the button", async () => {
		const picked = vi.fn();
		render(
			<Popover>
				<PopoverTrigger render={<Button variant="secondary">태그 고르기</Button>} />
				<PopoverContent width="sm" padding="menu">
					<Command>
						<CommandInput placeholder="태그 찾기" />
						<CommandList aria-label="태그">
							<CommandGroup heading="태그">
								{ROWS.map((row) => (
									<CommandItem key={row} onSelect={() => picked(row)}>
										{row}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>,
		);
		const opener = page.getByRole("button", { name: "태그 고르기" });
		await userEvent.click(opener);
		const list = page.getByRole("listbox");
		await expect.element(list).toBeVisible();
		const box = list.element().getBoundingClientRect();
		expect(box.top).toBeGreaterThanOrEqual(0);
		expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
		// More rows than it shows: it scrolls itself.
		expect(list.element().scrollHeight).toBeGreaterThan(list.element().clientHeight);
		await userEvent.keyboard("{ArrowDown}{Escape}");
		await expect.element(list).not.toBeInTheDocument();
		await expect.element(opener).toHaveFocus();
		expect(picked).not.toHaveBeenCalled();
	});
});
