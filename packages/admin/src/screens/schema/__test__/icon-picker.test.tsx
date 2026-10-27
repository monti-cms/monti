import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withSite } from "../../../test/site";
import { SchemaEditProvider } from "../controls";
import { IconPicker } from "../icon-picker";

afterEach(cleanup);

const renderPicker = (ui: ReactElement) =>
	render(
		withSite(
			<SchemaEditProvider
				value={{
					disabled: false,
					vocabulary: { blocks: [], marks: [] },
					issues: [],
					collectionNames: [],
					codeCollections: [],
					file: {},
					saved: {},
				}}
			>
				{ui}
			</SchemaEditProvider>,
		),
	);

describe("IconPicker", () => {
	it("renders trigger with default label when value is undefined", () => {
		renderPicker(<IconPicker label="Icon" value={undefined} kind="document" onChange={() => {}} />);
		expect(screen.getByRole("button", { name: /Icon/ })).toBeTruthy();
	});

	it("opens popover with a grid of icons on click, filters by search, and picks an icon", () => {
		const onChange = vi.fn();
		renderPicker(<IconPicker label="Icon" value={undefined} kind="document" onChange={onChange} />);

		// Open popover
		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		expect(screen.getByRole("textbox")).toBeTruthy();
		expect(screen.getByRole("button", { name: "folder" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "calendar" })).toBeTruthy();

		// Filter
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "book" } });
		expect(screen.getByRole("button", { name: "bookmark" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "book-open" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "calendar" })).toBeNull();

		// Pick icon
		fireEvent.click(screen.getByRole("button", { name: "bookmark" }));
		expect(onChange).toHaveBeenCalledWith("bookmark");
	});

	it("marks the picked icon as pressed, and no other", () => {
		renderPicker(<IconPicker label="Icon" value="star" kind="document" onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		expect(screen.getByRole("button", { name: "star" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: "folder" }).getAttribute("aria-pressed")).toBe("false");
	});

	it("shows clear button when icon is set and clears it to default", () => {
		const onChange = vi.fn();
		renderPicker(<IconPicker label="Icon" value="star" kind="document" onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		const clearBtn = screen.getByRole("button", { name: /default|기본/i });
		expect(clearBtn).toBeTruthy();

		fireEvent.click(clearBtn);
		expect(onChange).toHaveBeenCalledWith(undefined);
	});
});
