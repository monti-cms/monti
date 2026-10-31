import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "../chat-input";
import { ChatMessage } from "../chat-message";
import { ToolCallLine } from "../tool-call-line";

describe("ChatMessage", () => {
	it("UI-A1 is busy while the answer is arriving", () => {
		const { rerender } = render(<ChatMessage author="user">Hello</ChatMessage>);
		expect(screen.getByText("Hello").getAttribute("aria-busy")).toBeNull();
		rerender(
			<ChatMessage author="assistant" streaming>
				Hello
			</ChatMessage>,
		);
		expect(screen.getByText("Hello").getAttribute("aria-busy")).toBe("true");
	});
});

describe("ToolCallLine", () => {
	const details = [
		{ label: "Input", value: '{ "a": 1 }' },
		{ label: "Result", value: '{ "b": 2 }' },
	];

	it("UI-A2 is a plain line without details, and opens to the details with them", () => {
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
		expect(screen.getByText("Input")).toBeInTheDocument();
		expect(screen.getByText('{ "b": 2 }')).toBeInTheDocument();
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

	it("UI-K5 sends the trimmed text from the button and from Enter, but not from Shift+Enter", () => {
		const { onSubmit } = setup();
		fireEvent.click(screen.getByRole("button", { name: "Send" }));
		fireEvent.keyDown(box(), { key: "Enter" });
		fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
		expect(onSubmit).toHaveBeenCalledTimes(2);
		expect(onSubmit).toHaveBeenCalledWith("hello");
	});

	it("UI-S2 reports typing", () => {
		const { onValueChange } = setup({ value: "" });
		fireEvent.change(box(), { target: { value: "x" } });
		expect(onValueChange).toHaveBeenCalledWith("x");
	});

	it("UI-S1 sends nothing while blank", () => {
		const blank = setup({ value: "   " });
		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		fireEvent.keyDown(box(), { key: "Enter" });
		expect(blank.onSubmit).not.toHaveBeenCalled();
	});

	it("UI-S1 is off as a whole when disabled", () => {
		const off = setup({ disabled: true });
		expect(box().hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
		fireEvent.keyDown(box(), { key: "Enter" });
		expect(off.onSubmit).not.toHaveBeenCalled();
	});

	it("UI-S1 turns the send button into a stop button while busy, and does not send", () => {
		const { onStop, onSubmit } = setup({ busy: true });
		expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		fireEvent.keyDown(box(), { key: "Enter" });
		expect(onStop).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
