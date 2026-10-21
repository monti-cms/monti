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

describe("search box", () => {
	it("turns body search on and off with the toggle inside the box", () => {
		const onChange = vi.fn();
		render(withSite(<ListSearch state={stateOf("collection=post")} onChange={onChange} />));
		const toggle = screen.getByRole("button", { name: t("toolbar.includeBody") });
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(onChange).toHaveBeenLastCalledWith({ includeBody: true });
	});

	it("shows the toggle pressed while body search is on", () => {
		const onChange = vi.fn();
		render(withSite(<ListSearch state={stateOf("collection=post&body=1")} onChange={onChange} />));
		const toggle = screen.getByRole("button", { name: t("toolbar.includeBody") });
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(toggle);
		expect(onChange).toHaveBeenLastCalledWith({ includeBody: false });
	});

	it("has no body toggle for an item collection or where body search is not allowed", () => {
		render(withSite(<ListSearch state={stateOf("collection=tag")} onChange={vi.fn()} />));
		expect(screen.queryByRole("button", { name: t("toolbar.includeBody") })).toBeNull();
		cleanup();
		render(withSite(<ListSearch state={stateOf("collection=post")} onChange={vi.fn()} allowBody={false} />));
		expect(screen.queryByRole("button", { name: t("toolbar.includeBody") })).toBeNull();
	});
});
