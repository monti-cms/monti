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

	it("a Text with no role of its own takes the role around it, and an explicit role still wins", () => {
		render(
			<>
				<Heading variant="heading">
					<Text truncate>Posts</Text>
					<Text variant="caption">12</Text>
				</Heading>
				<Text variant="caption">
					<Text weight="semibold">bold</Text>
				</Text>
				<Text>alone</Text>
			</>,
		);
		expect(screen.getByText("Posts").className).not.toContain("text-monti-body");
		expect(screen.getByText("12").className).toContain("text-monti-caption");
		expect(screen.getByText("bold").className).toBe("font-semibold");
		expect(screen.getByText("alone").className).toContain("text-monti-body");
	});

	it("Stack picks its gap by meaning", () => {
		render(
			<Stack data-testid="stack" direction="row" gap="condensed" align="center">
				<span>a</span>
			</Stack>,
		);
		expect(screen.getByTestId("stack").className).toBe("flex flex-row gap-monti-8 items-center");
	});
});
