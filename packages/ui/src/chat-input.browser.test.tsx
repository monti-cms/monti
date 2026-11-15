import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { typeKorean } from "../../../testing/input";
import { render } from "../test/render";
import { ChatInput, ModelMenuButton, ThinkingMenu } from "./index";

function Box({ sent }: { sent: string[] }) {
	const [value, setValue] = useState("");
	return (
		<ChatInput
			value={value}
			onValueChange={setValue}
			onSubmit={(words) => {
				sent.push(words);
				setValue("");
			}}
			onStop={() => {}}
			label="Ask"
			sendLabel="Send"
			stopLabel="Stop"
		/>
	);
}

describe("ChatInput", () => {
	it("an Enter while a Hangul syllable is being composed does not send", async () => {
		const sent: string[] = [];
		render(<Box sent={sent} />);
		await userEvent.click(page.getByRole("textbox", { name: "Ask" }));
		// The last syllable is still being composed, as when a person stops mid-word and presses Enter.
		await typeKorean("안녕", { commit: false });
		await userEvent.keyboard("{Enter}");
		expect(sent).toEqual([]);
	});

	it("the Enter that Safari sends after it ended a composition (key code 229) does not send; the next Enter sends what was typed", async () => {
		const sent: string[] = [];
		render(<Box sent={sent} />);
		const box = page.getByRole("textbox", { name: "Ask" });
		await userEvent.fill(box, "안녕");
		// Safari ends the composition first and then sends the Enter that ended it: not composing any more, with the input method's key
		// code. Chromium does not do this by itself, so this one key event is made by hand.
		box
			.element()
			.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }));
		expect(sent).toEqual([]);
		await expect.element(box).toHaveValue("안녕");
		await userEvent.keyboard("{Enter}");
		expect(sent).toEqual(["안녕"]);
	});

	it("the box is the same element when the card of waiting messages comes and goes: what is being typed keeps the keyboard", async () => {
		function Busy() {
			const [value, setValue] = useState("");
			const [waiting, setWaiting] = useState<string[]>([]);
			return (
				<ChatInput
					value={value}
					onValueChange={setValue}
					onSubmit={() => {}}
					onStop={() => {}}
					busy
					onQueue={(words) => {
						setWaiting((was) => [...was, words]);
						setValue("");
					}}
					queue={waiting.length > 0 ? waiting.map((words) => <li key={words}>{words}</li>) : undefined}
					label="Ask"
					sendLabel="Send"
					stopLabel="Stop"
				/>
			);
		}
		render(<Busy />);
		const box = page.getByRole("textbox", { name: "Ask" });
		await userEvent.click(box);
		const typedIn = box.element();
		await userEvent.keyboard("wait for me{Enter}");
		await expect.element(page.getByText("wait for me")).toBeVisible();
		expect(box.element()).toBe(typedIn);
		expect(document.activeElement).toBe(typedIn);
		// And what is typed next goes into it, with no press on the box in between.
		await userEvent.keyboard("and this");
		await expect.element(box).toHaveValue("and this");
	});

	it("a model name longer than the row is cut inside its button; the thinking button stays beside it on the row, and both end left of the send button (AS-41)", async () => {
		const name = "Nous: Hermes 4 405B Instruct Turbo Preview (extended context, free)";
		render(
			<div style={{ width: 300 }}>
				<ChatInput
					value=""
					onValueChange={() => {}}
					onSubmit={() => {}}
					onStop={() => {}}
					label="Ask"
					sendLabel="Send"
					stopLabel="Stop"
					aside={
						<>
							<ModelMenuButton model={name} label="Model" />
							<ThinkingMenu
								value="medium"
								options={[{ value: "medium", label: "Medium" }]}
								onValueChange={() => {}}
								label="Thinking"
								text="Thinking medium"
							/>
						</>
					}
				/>
			</div>,
		);
		const model = page.getByRole("button", { name: "Model" });
		await expect.element(model).toBeVisible();
		// No browser `title` on a button: the cut name is said whole by the tooltip every cut line has.
		expect(model.element().hasAttribute("title")).toBe(false);
		const words = model.element().querySelector<HTMLElement>("[data-slot=cut-words]");
		expect(words && words.scrollWidth > words.clientWidth).toBe(true);
		await userEvent.hover(words as HTMLElement);
		await expect.element(page.getByRole("tooltip")).toHaveTextContent(name);
		const send = page.getByRole("button", { name: "Send" }).element().getBoundingClientRect();
		const thinking = page.getByRole("button", { name: "Thinking" }).element().getBoundingClientRect();
		const box = model.element().getBoundingClientRect();
		expect(box.right).toBeLessThanOrEqual(thinking.left);
		expect(thinking.top).toBe(box.top);
		expect(thinking.right).toBeLessThanOrEqual(send.left);
	});
});
