import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading, Text } from "../text";

describe("Text and Heading", () => {
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
