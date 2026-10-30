import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestRouter } from "../../../test/router";
import { enumParam, pageParam, pageSizeParam, textParam, useUrlState } from "../use-url-state";

const PARAMS = {
	page: pageParam,
	pageSize: pageSizeParam,
	filter: enumParam(["all", "failed"] as const, "all"),
	q: textParam,
};

function Probe() {
	const [state, update] = useUrlState(PARAMS);
	return (
		<div>
			<output data-testid="state">{JSON.stringify(state)}</output>
			<button type="button" onClick={() => update({ page: 3 })}>
				page
			</button>
			<button type="button" onClick={() => update({ filter: "failed" })}>
				filter
			</button>
			<button type="button" onClick={() => update({ filter: "all" })}>
				back
			</button>
		</div>
	);
}

const shown = () => JSON.parse(screen.getByTestId("state").textContent ?? "{}");

describe("useUrlState", () => {
	it("reads the address and falls back to defaults for bad values", () => {
		const host = createTestRouter({ search: "page=2&pageSize=7&filter=nope" });
		host.render(<Probe />);
		expect(shown()).toEqual({ page: 2, pageSize: 25, filter: "all", q: "" });
	});

	it("writes a change to the address and leaves defaults and foreign parameters alone", () => {
		const host = createTestRouter({ search: "tab=x" });
		host.render(<Probe />);
		act(() => screen.getByText("page").click());
		expect(host.search.get("page")).toBe("3");
		expect(host.search.get("tab")).toBe("x");
		act(() => screen.getByText("filter").click());
		expect(host.search.get("filter")).toBe("failed");
		// Changing a filter goes back to the first page, which is the default and so not written.
		expect(host.search.has("page")).toBe(false);
		act(() => screen.getByText("back").click());
		expect(host.search.has("filter")).toBe(false);
		expect(shown().filter).toBe("all");
	});

	it("follows a change of the address made elsewhere", () => {
		const host = createTestRouter();
		host.render(<Probe />);
		act(() => host.setSearch("page=4&q=hello"));
		expect(shown()).toMatchObject({ page: 4, q: "hello" });
	});
});
