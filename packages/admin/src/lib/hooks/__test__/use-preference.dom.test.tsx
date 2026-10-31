import { SiteProvider } from "@monti-cms/core/site";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { removePreference, writePreference } from "../../utils/site-storage";
import { booleanCodec, enumCodec, usePreference } from "../use-preference";

const wrap = (node: ReactNode) => <SiteProvider site={testSite}>{node}</SiteProvider>;

function Probe({ id }: { id: string }) {
	const [view, setView, reset] = usePreference("probe-view", enumCodec(["grid", "list"] as const), "grid");
	return (
		<div>
			<output aria-label={id} data-testid={id}>
				{view}
			</output>
			<button type="button" onClick={() => setView("list")}>
				set-{id}
			</button>
			<button type="button" onClick={reset}>
				reset-{id}
			</button>
		</div>
	);
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("usePreference", () => {
	it("starts with the remembered value on the first render, not the default", () => {
		writePreference(testSite, "probe-view", "list");
		const seen: string[] = [];
		function Spy() {
			const [view] = usePreference("probe-view", enumCodec(["grid", "list"] as const), "grid");
			seen.push(view);
			return null;
		}
		render(wrap(<Spy />));
		expect(seen[0]).toBe("list");
	});

	it("ADMIN-S1 falls back to the default for a missing or invalid stored value", () => {
		writePreference(testSite, "probe-view", "sideways");
		render(wrap(<Probe id="a" />));
		expect(screen.getByLabelText("a").textContent).toBe("grid");
	});

	it("keeps every component on one preference in step, and forgets it on reset", async () => {
		render(
			wrap(
				<>
					<Probe id="a" />
					<Probe id="b" />
				</>,
			),
		);
		await act(async () => screen.getByText("set-a").click());
		expect(screen.getByTestId("b").textContent).toBe("list");
		await act(async () => screen.getByText("reset-b").click());
		expect(screen.getByTestId("a").textContent).toBe("grid");
		expect(window.localStorage.length).toBe(0);
	});

	it("follows a change made outside the component", () => {
		render(wrap(<Probe id="a" />));
		act(() => writePreference(testSite, "probe-view", "list"));
		expect(screen.getByTestId("a").textContent).toBe("list");
		act(() => removePreference(testSite, "probe-view"));
		expect(screen.getByTestId("a").textContent).toBe("grid");
	});
});

describe("preference codecs", () => {
	it("reads booleans and positive numbers strictly", () => {
		expect(booleanCodec.parse("1")).toBe(true);
		expect(booleanCodec.parse("0")).toBe(false);
		expect(booleanCodec.parse("yes")).toBeUndefined();
	});
});
