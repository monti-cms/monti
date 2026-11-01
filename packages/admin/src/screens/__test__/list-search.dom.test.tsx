import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection, recordCollection } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { renderInRouter as render } from "../../test/router";
import { withSite } from "../../test/site";
import { ListSearch } from "../list-search";
import { parseListState } from "../list-state";
import { screensMessages } from "../messages";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);
const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));

// The picker's name starts with the place now picked (its visible text) and then says what it is.
const picker = () => screen.queryByRole("button", { name: new RegExp(`, ${t("toolbar.target")}$`) });

describe("search box", () => {
	it("LIST-F1 turns body search on and off with the picker in front of the box", async () => {
		const onChange = vi.fn();
		render(withSite(<ListSearch state={stateOf(`collection=${contentCollection}`)} onChange={onChange} />));
		// The header shows the "Search" button; pressed, the box opens with its picker.
		fireEvent.click(screen.getByRole("button", { name: t("toolbar.search") }));
		fireEvent.click(picker() as HTMLElement);
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("toolbar.targetAll") }));
		expect(onChange).toHaveBeenLastCalledWith({ includeBody: true });
	});

	it("LIST-F1 has no picker for an item collection or where body search is not allowed", () => {
		render(withSite(<ListSearch state={stateOf(`collection=${recordCollection}`)} onChange={vi.fn()} />));
		fireEvent.click(screen.getByRole("button", { name: t("toolbar.search") }));
		expect(picker()).toBeNull();
		cleanup();
		render(
			withSite(<ListSearch state={stateOf(`collection=${contentCollection}`)} onChange={vi.fn()} allowBody={false} />),
		);
		fireEvent.click(screen.getByRole("button", { name: t("toolbar.search") }));
		expect(picker()).toBeNull();
	});
});
