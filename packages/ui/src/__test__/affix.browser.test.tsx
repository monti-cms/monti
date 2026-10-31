import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { Affix } from "../affix";

afterEach(cleanup);

describe("Affix", () => {
	it("UI-K1 is one tab stop: Tab goes from the control before it to the input, and on to the control after it", async () => {
		render(
			<>
				<button type="button">Before</button>
				<Affix aria-label="Address" prefix="/" suffix="/:slug" defaultValue="posts" />
				<button type="button">After</button>
			</>,
		);
		screen.getByRole("button", { name: "Before" }).focus();
		await act(() => userEvent.tab());
		expect(document.activeElement).toBe(screen.getByLabelText("Address"));
		await act(() => userEvent.tab());
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
	});
});
