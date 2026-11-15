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
		// The whole block's text with its tags, so a translation keeps its links, code words and bold.
		expect(said).toContain("`setText` of that block's whole translated text that keeps every tag");
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

describe("the language the assistant answers in (doc 10, TR-19)", () => {
	it("10 a request names the admin's language, whatever language the content is in", () => {
		const said = requestWith("번역", ScreenContext.parse({ screen: "entry", task: "translate" }), "ko");
		expect(said).toContain("Answer in Korean, the admin's language.");
		// It comes before the screen's data, as the request's own words.
		expect(said.indexOf("Answer in Korean")).toBeLessThan(said.indexOf("<screen"));
		expect(requestWith("요약 써 줘", null, "en")).toBe("요약 써 줘\n\nAnswer in English, the admin's language.");
		expect(requestWith("요약 써 줘", null)).toBe("요약 써 줘");
	});
});
