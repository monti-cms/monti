import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { DEFAULT_UI_LABELS } from "../labels";
import { SearchToggle } from "../search-box";

afterEach(cleanup);

describe("SearchToggle", () => {
	function Toggle({ initial = "" }: { initial?: string }) {
		const [value, setValue] = useState(initial);
		return (
			<>
				<SearchToggle label="Search" aria-label="Search words" value={value} onValueChange={setValue} />
				<button type="button">Elsewhere</button>
			</>
		);
	}

	it("UI-K3 stays a box while it holds words, even when left; the × empties it and keeps it open with the field focused", async () => {
		render(<Toggle initial="react" />);
		await act(() => userEvent.click(screen.getByRole("searchbox", { name: "Search words" })));
		await act(() => userEvent.click(screen.getByRole("button", { name: "Elsewhere" })));
		expect(screen.getByRole("searchbox", { name: "Search words" })).toBeInTheDocument();
		// A real click moves the focus from the field to the × first; the box must not take that for leaving.
		await act(() => userEvent.click(screen.getByRole("button", { name: DEFAULT_UI_LABELS.clear })));
		const emptied = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search words" });
		expect(emptied.value).toBe("");
		expect(document.activeElement).toBe(emptied);
		await act(() => userEvent.click(screen.getByRole("button", { name: "Elsewhere" })));
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
	});
});
