import { SiteProvider } from "@monti-cms/core/site";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { writePreference } from "../../utils/site-storage";
import { enumCodec, usePreference } from "../use-preference";

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
	it("ADMIN-S1 falls back to the default for a missing or invalid stored value", () => {
		writePreference(testSite, "probe-view", "sideways");
		render(wrap(<Probe id="a" />));
		expect(screen.getByLabelText("a").textContent).toBe("grid");
	});
});
