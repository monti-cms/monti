import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchBox, SearchToggle } from "../search-box";

afterEach(cleanup);

describe("SearchBox target picker", () => {
	it("is named with its visible text first (label in name), then what it is", () => {
		render(
			<SearchBox
				aria-label="Search"
				value=""
				onValueChange={() => {}}
				targets={[
					{ value: "fields", label: "Title, address" },
					{ value: "all", label: "Everything" },
				]}
				target="all"
				targetLabel="Where to search"
			/>,
		);
		const picker = screen.getByRole("button", { name: /Where to search/ });
		expect(picker.textContent).toBe("Everything");
		expect(picker.getAttribute("aria-label")?.startsWith(picker.textContent ?? "")).toBe(true);
	});
});

describe("SearchToggle", () => {
	function Toggle({ initial = "" }: { initial?: string }) {
		const [value, setValue] = useState(initial);
		return <SearchToggle label="Search" aria-label="Search words" value={value} onValueChange={setValue} />;
	}

	it("is a button until pressed, then the box with its field focused; emptied and Escape, the button again", () => {
		render(<Toggle />);
		expect(screen.queryByRole("searchbox")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		const field = screen.getByRole("searchbox", { name: "Search words" });
		expect(document.activeElement).toBe(field);
		fireEvent.keyDown(field, { key: "Escape" });
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
	});

	it("stays a box while it holds words, even when left; the × empties it and keeps it open with the field focused", () => {
		render(<Toggle initial="react" />);
		const field = screen.getByRole("searchbox", { name: "Search words" });
		fireEvent.blur(field);
		expect(screen.getByRole("searchbox", { name: "Search words" })).toBeTruthy();
		const clear = screen.getByRole("button", { name: /clear|지우기/i });
		fireEvent.focus(clear);
		fireEvent.click(clear);
		const emptied = screen.getByRole("searchbox", { name: "Search words" }) as HTMLInputElement;
		expect(emptied.value).toBe("");
		expect(document.activeElement).toBe(emptied);
		fireEvent.blur(emptied);
		expect(screen.queryByRole("searchbox")).toBeNull();
	});
});
