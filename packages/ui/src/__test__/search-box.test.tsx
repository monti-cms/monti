import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchBox } from "../search-box";

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
