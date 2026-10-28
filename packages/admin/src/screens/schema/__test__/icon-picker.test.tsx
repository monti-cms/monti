import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withSite } from "../../../test/site";
import { COLLECTION_ICON_NAMES as NAMES } from "../../shared/collection-icon";
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

	it("opens popover with a grid of the built-in icons, filters by search, and picks an icon", () => {
		const onChange = vi.fn();
		renderPicker(<IconPicker label="Icon" value={undefined} kind="document" onChange={onChange} />);

		// Open popover: every built-in icon is offered by its name.
		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		expect(screen.getByRole("textbox")).toBeTruthy();
		for (const name of NAMES.slice(0, 3)) expect(screen.getByRole("button", { name })).toBeTruthy();

		// Filter by a part of one name: the icons whose names contain it stay, the others go.
		const needle = (NAMES[0] as string).slice(0, 3);
		const kept = NAMES.filter((name) => name.includes(needle));
		const dropped = NAMES.find((name) => !name.includes(needle)) as string;
		fireEvent.change(screen.getByRole("textbox"), { target: { value: needle } });
		for (const name of kept) expect(screen.getByRole("button", { name })).toBeTruthy();
		expect(screen.queryByRole("button", { name: dropped })).toBeNull();

		// Pick icon
		fireEvent.click(screen.getByRole("button", { name: kept[0] as string }));
		expect(onChange).toHaveBeenCalledWith(kept[0]);
	});

	it("marks the picked icon as pressed, and no other", () => {
		const [picked, other] = NAMES as [string, string];
		renderPicker(<IconPicker label="Icon" value={picked} kind="document" onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		expect(screen.getByRole("button", { name: picked }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: other }).getAttribute("aria-pressed")).toBe("false");
	});

	it("shows clear button when icon is set and clears it to default", () => {
		const onChange = vi.fn();
		renderPicker(<IconPicker label="Icon" value={NAMES[0]} kind="document" onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: /Icon/ }));
		const clearBtn = screen.getByRole("button", { name: /default|기본/i });
		expect(clearBtn).toBeTruthy();

		fireEvent.click(clearBtn);
		expect(onChange).toHaveBeenCalledWith(undefined);
	});
});
