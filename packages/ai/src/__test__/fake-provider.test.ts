import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type AiFakeHint, type AiRequest, createFakeGenerator } from "../provider";

const request = (result: AiRequest<unknown>["result"], fake: AiFakeHint): AiRequest<Record<string, unknown>> => ({
	system: "",
	content: [],
	schema: z.record(z.string(), z.unknown()),
	maxTokens: 100,
	result,
	fake,
});

const streamed = async (result: AiRequest<unknown>["result"], fake: AiFakeHint) => {
	let text = "";
	for await (const piece of createFakeGenerator().stream({ ...request(result, fake) })) text += piece;
	return text;
};

describe("가짜 생성 모델(개발 전용)", () => {
	const fake = createFakeGenerator();

	it("결과 모양과 입력 종류로 답한다(입력 이름은 보지 않는다)", async () => {
		const inputs = {
			heading: { kind: "text", value: "React Hooks" },
			source: { kind: "mdx", value: "안녕 **세계**" },
		} as const;
		expect(await fake.generate(request("mdx", { inputs }))).toEqual({ mdx: "안녕 **세계**" });
		expect(await fake.generate(request("text", { inputs }))).toEqual({ text: "(fake) React Hooks" });
		expect(await fake.generate(request("note", { inputs }))).toEqual({ note: "(fake) note" });
		expect(await fake.generate(request("candidates", { inputs: { heading: inputs.heading } }))).toEqual({
			candidates: ["react-hooks", "react-hooks-guide", "fake-react-hooks"],
		});
		// 코드 입력이면 그 코드에서 찾는 정규식, 선택지가 있으면 선택지 안에서 고른다.
		expect(
			await fake.generate(request("candidates", { inputs: { snippet: { kind: "code", value: "const a = 1" } } })),
		).toEqual({ candidates: ["const", "\\d+"] });
		expect(await fake.generate(request("candidates", { inputs: {}, choices: ["c1", "c2"] }))).toEqual({
			candidates: ["c1", "c2"],
		});
	});

	it("흘려받기는 글로 시작하는 MDX에만 표시를 붙이고, 블록 문법으로 시작하면 그대로 둔다", async () => {
		expect(await streamed("mdx", { inputs: { piece: { kind: "mdx", value: "고칠 글" } } })).toBe("(fake) 고칠 글");
		const fence = "```js\nconst a = 1;\n```";
		expect(await streamed("mdx", { inputs: { piece: { kind: "mdx", value: fence } } })).toBe(fence);
		expect(await streamed("mdx", { inputs: { name: { kind: "text", value: "새 제목" } } })).toContain("## 새 제목");
	});

	it("기능이 정한 가짜 답이 있으면 그것을 쓴다(후보는 줄마다 하나)", async () => {
		expect(await fake.generate(request("mdx", { inputs: {}, answer: () => "```chart\nx\n```" }))).toEqual({
			mdx: "```chart\nx\n```",
		});
		expect(await fake.generate(request("candidates", { inputs: {}, answer: () => "a\n\nb" }))).toEqual({
			candidates: ["a", "b"],
		});
	});
});
