import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeRef } from "../code-ref/render.client";
import { TabsView } from "../tabs/render.client";
import { Tooltip } from "../tooltip/render.client";

afterEach(cleanup);

const selected = (tab: HTMLElement | undefined) => tab?.getAttribute("aria-selected") === "true";

describe("public page client components", () => {
	it("tabs switch with click and arrow/Home/End keys, and only the selected tab body is shown", () => {
		render(
			<TabsView
				labels={["A", "B", "C"]}
				panels={[<p key="a">a 내용</p>, <p key="b">b 내용</p>, <p key="c">c 내용</p>]}
			/>,
		);
		const tabs = screen.getAllByRole("tab");
		expect(selected(tabs[0])).toBe(true);
		expect(screen.getByText("a 내용").parentElement?.hidden).toBe(false);
		expect(screen.getByText("b 내용").parentElement?.hidden).toBe(true);

		fireEvent.click(tabs[1] as HTMLElement);
		expect(selected(tabs[1])).toBe(true);
		expect(screen.getByText("b 내용").parentElement?.hidden).toBe(false);

		fireEvent.keyDown(tabs[1] as HTMLElement, { key: "ArrowRight" });
		expect(selected(tabs[2])).toBe(true);
		expect(document.activeElement).toBe(tabs[2]);
		// Right arrow at the end wraps to the start.
		fireEvent.keyDown(tabs[2] as HTMLElement, { key: "ArrowRight" });
		expect(selected(tabs[0])).toBe(true);
		fireEvent.keyDown(tabs[0] as HTMLElement, { key: "End" });
		expect(selected(tabs[2])).toBe(true);
		fireEvent.keyDown(tabs[2] as HTMLElement, { key: "Home" });
		expect(selected(tabs[0])).toBe(true);
		// A tab panel is named after its tab label.
		const panel = screen.getAllByRole("tabpanel", { hidden: true })[1];
		expect(panel?.getAttribute("aria-labelledby")).toBe(tabs[1]?.id);
	});

	it("tooltip opens on focus and closes with Esc", () => {
		render(<Tooltip content="뜻풀이">용어</Tooltip>);
		const wrapper = screen.getByText("용어").closest(".cms-block-tooltip") as HTMLElement;
		const trigger = screen.getByText("용어");
		expect(wrapper.hasAttribute("data-open")).toBe(false);
		fireEvent.focus(trigger);
		expect(wrapper.hasAttribute("data-open")).toBe(true);
		fireEvent.keyDown(trigger, { key: "Escape" });
		expect(wrapper.hasAttribute("data-open")).toBe(false);
		expect(document.getElementById(trigger.getAttribute("aria-describedby") ?? "")?.textContent).toBe("뜻풀이");
	});

	it("code ref highlights the linked code line on focus and restores it on blur", async () => {
		document.body.innerHTML = `<pre><code><span class="line" data-anchor="c1 c2">a</span><span class="line">b</span></code></pre><div id="root"></div>`;
		const line = document.querySelector(".line") as HTMLElement;
		const pre = document.querySelector("pre") as HTMLElement;
		render(<CodeRef to="c1">이 줄</CodeRef>, { container: document.getElementById("root") as HTMLElement });
		const ref = await screen.findByRole("button", { name: "이 줄" });

		fireEvent.focus(ref);
		expect(line.hasAttribute("data-focused")).toBe(true);
		expect(pre.hasAttribute("data-code-focus")).toBe(true);
		fireEvent.blur(ref);
		expect(line.hasAttribute("data-focused")).toBe(false);
		expect(pre.hasAttribute("data-code-focus")).toBe(false);
	});

	it("without a linked code line it appears as plain text", async () => {
		document.body.innerHTML = '<div id="root"></div>';
		render(<CodeRef to="없음">그냥 글자</CodeRef>, { container: document.getElementById("root") as HTMLElement });
		await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
		expect(screen.getByText("그냥 글자")).toBeTruthy();
	});
});
