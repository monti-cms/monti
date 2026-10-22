import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../dropdown-menu";

afterEach(cleanup);

const source = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
// A menu opened from a small icon button must not be as narrow as that button.
const FIXED_TO_ANCHOR = /(^|[\s"'])w-\(--anchor-width\)/;

describe("menu widths", () => {
	it("sizes a dropdown menu to its items, not to the button that opened it", async () => {
		render(
			<DropdownMenu>
				<DropdownMenuTrigger>open</DropdownMenuTrigger>
				<DropdownMenuContent data-testid="menu">
					<DropdownMenuItem>휴지통으로 이동</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.click(screen.getByText("open"));
		const menu = await screen.findByTestId("menu");
		expect(menu.className).not.toMatch(FIXED_TO_ANCHOR);
		expect(menu.className).toContain("w-max");
		expect(menu.className).toContain("min-w-32");
	});

	it("keeps context menus and selects from being fixed to their anchor's width", () => {
		for (const file of ["dropdown-menu.tsx", "context-menu.tsx", "select.tsx"]) {
			expect(source(file), file).not.toMatch(FIXED_TO_ANCHOR);
		}
		// A select still opens at least as wide as its trigger.
		expect(source("select.tsx")).toContain("var(--anchor-width)");
	});
});
