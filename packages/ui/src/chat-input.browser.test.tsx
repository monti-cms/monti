import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { typeKorean } from "../../../testing/input";
import { render } from "../test/render";
import { ChatInput } from "./index";

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
});
