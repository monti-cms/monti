import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Copy } from "./icons";
import { ChatMessage, ChatMessageActions, ChatThread, IconButton } from "./index";

const box = (name: string) => page.getByText(name).element().getBoundingClientRect();
const row = (index: number) =>
	(document.querySelectorAll("[data-slot=chat-message-actions]")[index] as HTMLElement).getBoundingClientRect();

describe("ChatMessageActions", () => {
	it("the row takes the thread's gap: a message is 36px from what follows it, the row 4px under the message and 8px over the next thing; without a row the gap is the thread's 24px; showing the row moves nothing", async () => {
		render(
			<div className="h-[600px] w-[400px]">
				<ChatThread>
					<ChatMessage author="user">first question</ChatMessage>
					<ChatMessageActions author="user" time="10:58">
						<IconButton label="Copy">
							<Copy />
						</IconButton>
					</ChatMessageActions>
					<ChatMessage author="assistant">first answer</ChatMessage>
					<ChatMessageActions author="assistant">
						<IconButton label="Copy the answer">
							<Copy />
						</IconButton>
					</ChatMessageActions>
					<ChatMessage author="user">second question</ChatMessage>
					<ChatMessage author="assistant">second answer</ChatMessage>
				</ChatThread>
			</div>,
		);
		await expect.element(page.getByText("second answer")).toBeVisible();
		const measure = () => ({
			questionToAnswer: box("first answer").top - box("first question").bottom,
			underMessage: row(0).top - box("first question").bottom,
			overNext: box("first answer").top - row(0).bottom,
			answerToQuestion: box("second question").top - box("first answer").bottom,
			noRow: box("second answer").top - box("second question").bottom,
			rowHeight: row(0).height,
		});
		const atRest = measure();
		expect(atRest).toEqual({
			questionToAnswer: 36,
			underMessage: 4,
			overNext: 8,
			answerToQuestion: 36,
			noRow: 24,
			rowHeight: 24,
		});
		// The row is there and unseen until its message is pointed at; then it shows where it already stood.
		const first = document.querySelectorAll("[data-slot=chat-message-actions]")[0] as HTMLElement;
		expect(getComputedStyle(first).opacity).toBe("0");
		await userEvent.hover(page.getByText("first question"));
		await expect.poll(() => getComputedStyle(first).opacity).toBe("1");
		expect(measure()).toEqual(atRest);
	});
});
