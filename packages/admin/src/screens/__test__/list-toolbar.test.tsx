import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderInRouter as render } from "../../test/router";
import { withSite } from "../../test/site";
import { parseListState } from "../list-state";
import { ListSearch } from "../list-toolbar";
import { screensMessages } from "../messages";

afterEach(cleanup);

const t = testSite.createTranslator(screensMessages);
const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));

// The picker's name starts with the place now picked (its visible text) and then says what it is.
const picker = () => screen.queryByRole("button", { name: new RegExp(`, ${t("toolbar.target")}$`) });

describe("search box", () => {
	it("turns body search on and off with the picker in front of the box", async () => {
		const onChange = vi.fn();
		render(withSite(<ListSearch state={stateOf("collection=post")} onChange={onChange} />));
		fireEvent.click(picker() as HTMLElement);
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("toolbar.targetAll") }));
		expect(onChange).toHaveBeenLastCalledWith({ includeBody: true });
	});

	it("shows everything picked while body search is on", async () => {
		const onChange = vi.fn();
		render(withSite(<ListSearch state={stateOf("collection=post&body=1")} onChange={onChange} />));
		expect(picker()?.textContent).toBe(t("toolbar.targetAll"));
		expect(picker()?.getAttribute("aria-label")).toBe(`${t("toolbar.targetAll")}, ${t("toolbar.target")}`);
		fireEvent.click(picker() as HTMLElement);
		fireEvent.click(await screen.findByRole("menuitemradio", { name: t("toolbar.targetFields") }));
		expect(onChange).toHaveBeenLastCalledWith({ includeBody: false });
	});

	it("has no picker for an item collection or where body search is not allowed", () => {
		render(withSite(<ListSearch state={stateOf("collection=tag")} onChange={vi.fn()} />));
		expect(picker()).toBeNull();
		cleanup();
		render(withSite(<ListSearch state={stateOf("collection=post")} onChange={vi.fn()} allowBody={false} />));
		expect(picker()).toBeNull();
	});
});
