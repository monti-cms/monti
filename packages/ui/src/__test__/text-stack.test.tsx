import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading, Text } from "../text";

describe("Text and Heading", () => {
	it("Text is a span that shows its text", () => {
		render(
			<Text variant="caption" tone="muted">
				meta
			</Text>,
		);
		expect(screen.getByText("meta").tagName).toBe("SPAN");
	});

	it("Heading defaults to an h2, and a caller's class is kept beside its own", () => {
		render(<Heading className="mt-2">Settings</Heading>);
		const el = screen.getByRole("heading", { level: 2, name: "Settings" });
		expect(el.className).toContain("mt-2");
		expect(el.className.split(/\s+/).length).toBeGreaterThan(1);
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
		const role = /\btext-monti-/;
		// Inside a heading or a caption the text takes the role around it; alone it has a role of its own; a role it is given wins.
		expect(screen.getByText("Posts").className).not.toMatch(role);
		expect(screen.getByText("12").className).toMatch(role);
		expect(screen.getByText("bold").className).not.toMatch(role);
		expect(screen.getByText("alone").className).toMatch(role);
	});
});
