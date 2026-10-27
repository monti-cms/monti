import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "../chat-input";
import { ChatMessage } from "../chat-message";
import { SidePanelFrame } from "../side-panel-frame";
import { ToolCallLine } from "../tool-call-line";

describe("ChatMessage", () => {
	it("tells the role and, while the answer is arriving, that it is busy", () => {
		const { rerender } = render(<ChatMessage author="user">Hello</ChatMessage>);
		const message = screen.getByText("Hello");
		expect(message.getAttribute("data-author")).toBe("user");
		expect(message.getAttribute("aria-busy")).toBeNull();
		rerender(
			<ChatMessage author="assistant" streaming>
				Hello
			</ChatMessage>,
		);
		expect(screen.getByText("Hello").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByText("Hello").getAttribute("data-author")).toBe("assistant");
	});

	it("is the assistant's by default", () => {
		render(<ChatMessage>Hi</ChatMessage>);
		expect(screen.getByText("Hi").getAttribute("data-author")).toBe("assistant");
	});
});

describe("ToolCallLine", () => {
	const details = [
		{ label: "Input", value: '{ "a": 1 }' },
		{ label: "Result", value: '{ "b": 2 }' },
	];

	it("shows what was done and where the call stands, for each status", () => {
		for (const [status, word] of [
			["running", "Running"],
			["done", "Done"],
			["failed", "Failed"],
		] as const) {
			const { unmount, container } = render(
				<ToolCallLine status={status} statusLabel={word}>
					Read the post list
				</ToolCallLine>,
			);
			expect(screen.getByText("Read the post list")).toBeTruthy();
			expect(screen.getByText(word)).toBeTruthy();
			expect(container.querySelector("[data-slot=tool-call-line]")?.getAttribute("data-status")).toBe(status);
			unmount();
		}
	});

	it("is a plain line without details, and opens to the details with them", () => {
		const { rerender } = render(
			<ToolCallLine status="done" statusLabel="Done">
				x
			</ToolCallLine>,
		);
		expect(screen.queryByRole("button")).toBeNull();
		rerender(
			<ToolCallLine status="done" statusLabel="Done" details={details}>
				x
			</ToolCallLine>,
		);
		const line = screen.getByRole("button", { name: /x/ });
		expect(line.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Input")).toBeNull();
		fireEvent.click(line);
		expect(line.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("Input")).toBeTruthy();
		expect(screen.getByText('{ "b": 2 }')).toBeTruthy();
	});

	it("can start open", () => {
		render(
			<ToolCallLine status="failed" statusLabel="Failed" details={details} defaultOpen>
				x
			</ToolCallLine>,
		);
		expect(screen.getByText("Result")).toBeTruthy();
	});
});

describe("ChatInput", () => {
	const setup = (props: Partial<Parameters<typeof ChatInput>[0]> = {}) => {
		const onSubmit = vi.fn();
		const onStop = vi.fn();
		const onValueChange = vi.fn();
		render(
			<ChatInput
				value="  hello  "
				onValueChange={onValueChange}
				onSubmit={onSubmit}
				onStop={onStop}
				label="Message"
				sendLabel="Send"
				stopLabel="Stop"
				{...props}
			/>,
		);
		return { onSubmit, onStop, onValueChange };
	};
	const box = () => screen.getByRole("textbox", { name: "Message" });

	it("sends the trimmed text from the button and from Enter, but not from Shift+Enter", () => {
		const { onSubmit } = setup();
		fireEvent.click(screen.getByRole("button", { name: "Send" }));
		fireEvent.keyDown(box(), { key: "Enter" });
		fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
		expect(onSubmit).toHaveBeenCalledTimes(2);
		expect(onSubmit).toHaveBeenCalledWith("hello");
	});

	it("reports typing", () => {
		const { onValueChange } = setup({ value: "" });
		fireEvent.change(box(), { target: { value: "x" } });
		expect(onValueChange).toHaveBeenCalledWith("x");
	});

	it("sends nothing while blank or off", () => {
		const blank = setup({ value: "   " });
		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		fireEvent.keyDown(box(), { key: "Enter" });
		expect(blank.onSubmit).not.toHaveBeenCalled();
	});

	it("is off as a whole when disabled", () => {
		const off = setup({ disabled: true });
		expect(box().hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		expect(off.onSubmit).not.toHaveBeenCalled();
	});

	it("turns the send button into a stop button while busy, and does not send", () => {
		const { onStop, onSubmit } = setup({ busy: true });
		expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		fireEvent.keyDown(box(), { key: "Enter" });
		expect(onStop).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("shows the aside text at the start of the row", () => {
		setup({ aside: "150 tokens" });
		expect(screen.getByText("150 tokens")).toBeTruthy();
	});
});

describe("SidePanelFrame", () => {
	it("has the title, actions, body and footer", () => {
		render(
			<SidePanelFrame title="Assistant" actions={<button type="button">Act</button>} footer={<p>Footer</p>}>
				<p>Body</p>
			</SidePanelFrame>,
		);
		expect(screen.getByRole("heading", { name: "Assistant" })).toBeTruthy();
		for (const text of ["Body", "Footer"]) expect(screen.getByText(text)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
	});

	it("keeps the title, the actions and the close button in one header row", () => {
		const { container } = render(
			<SidePanelFrame title="Assistant" actions={<button type="button">Act</button>} onClose={() => undefined}>
				x
			</SidePanelFrame>,
		);
		const headers = container.querySelectorAll("[data-slot=side-panel-frame-header]");
		expect(headers).toHaveLength(1);
		const header = headers[0] as HTMLElement;
		for (const node of [
			screen.getByText("Assistant"),
			screen.getByRole("button", { name: "Act" }),
			screen.getByRole("button", { name: "Close" }),
		])
			expect(header.contains(node)).toBe(true);
		// The row is one flex line: its direct children sit side by side, not stacked.
		expect(header.className).toContain("flex");
		expect(header.className).not.toContain("flex-col");
	});

	it("has a close button only when it is given something to do", () => {
		const onClose = vi.fn();
		const { rerender } = render(<SidePanelFrame title="T">x</SidePanelFrame>);
		expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
		rerender(
			<SidePanelFrame title="T" onClose={onClose}>
				x
			</SidePanelFrame>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("has no footer area without a footer", () => {
		const { container } = render(<SidePanelFrame title="T">x</SidePanelFrame>);
		expect(container.querySelector("[data-slot=side-panel-frame-footer]")).toBeNull();
	});
});
