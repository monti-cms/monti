import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stack } from "../stack";
import { Heading, Text } from "../text";

describe("Text, Heading and Stack", () => {
	it("Text sets a role (variant) and a tone, and a span by default", () => {
		render(
			<Text variant="caption" tone="muted">
				meta
			</Text>,
		);
		const el = screen.getByText("meta");
		expect(el.tagName).toBe("SPAN");
		expect(el.className).toBe("text-monti-caption text-monti-muted");
	});

	it("Heading defaults to an h2 in the title role, and a caller's class can still adjust it", () => {
		render(<Heading className="mt-2">Settings</Heading>);
		const el = screen.getByRole("heading", { level: 2, name: "Settings" });
		expect(el.className).toContain("text-monti-title");
		expect(el.className).toContain("mt-2");
	});

	it("Stack picks its gap by meaning", () => {
		render(
			<Stack data-testid="stack" direction="row" gap="condensed" align="center">
				<span>a</span>
			</Stack>,
		);
		expect(screen.getByTestId("stack").className).toBe("flex flex-row gap-condensed items-center");
	});
});
