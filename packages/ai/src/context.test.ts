import { describe, expect, it } from "vitest";
import { requestWith, ScreenContext } from "./context";

describe("a set request of the editor's buttons (doc 10, item 19)", () => {
	it("10 T94 'translate' tells the model what the button means, apart from the person's words and the screen's data", () => {
		const context = ScreenContext.parse({
			screen: "entry",
			collection: "post",
			entry: { id: "e1", version: 3, title: "First post" },
			task: "translate",
			blocks: ["b_2"],
		});
		const said = requestWith("번역", context);
		expect(said.startsWith("번역\n\n")).toBe(true);
		expect(said).toContain("translate button");
		expect(said).toContain("one `body_edit` call per block");
		// The screen's own part still comes as data, with the blocks that are meant.
		expect(said).toContain('"blocks":["b_2"]');
		expect(requestWith("다시 번역", { ...context, task: "retranslate" })).toContain("translate again");
	});

	it("10 a request with no set task says nothing more than the person's words and the screen", () => {
		const said = requestWith("요약 써 줘", ScreenContext.parse({ screen: "entry" }));
		expect(said).not.toContain("pressed");
		expect(ScreenContext.safeParse({ screen: "entry", task: "delete everything" }).success).toBe(false);
	});
});
