import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageBody } from "../page-body";

afterEach(cleanup);

describe("page body", () => {
	it("is left-aligned under the header with one maximum width", () => {
		render(<PageBody data-testid="body">content</PageBody>);
		const body = screen.getByTestId("body");
		// Not centered: no auto margins.
		expect(body.className).not.toMatch(/\bmx-auto\b/);
		expect(body.className).toContain("max-w-page");
	});

	it("uses all the width for a workspace page, with the same padding", () => {
		render(
			<PageBody data-testid="body" wide>
				content
			</PageBody>,
		);
		const body = screen.getByTestId("body");
		expect(body.className).not.toContain("max-w-page");
		expect(body.className).toContain("px-wide");
	});
});
