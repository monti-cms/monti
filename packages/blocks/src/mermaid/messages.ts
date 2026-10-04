import { defineMessages } from "@monti-cms/core";

/**
 * Labels, descriptions, and AI feature text of the Mermaid block. AI instructions are text given to the model, so they exist in English only, and the result language follows the body.
 */
export const mermaidMessages = defineMessages("cms-blocks.mermaid", {
	en: {
		label: "Diagram",
		description: "Mermaid diagram or flowchart",
		keywords: "diagram,flowchart",
		placeholder: "Enter a Mermaid diagram",
		"ai.draft.label": "Create diagram",
		"ai.edit.label": "Edit diagram",
		"ai.input.title": "Title",
		"ai.input.body": "Current body",
		"ai.input.block": "Diagram",
		"ai.check.label": "Mermaid syntax",
		"ai.error.notFence": "Not a single ```mermaid code fence.",
		"ai.error.empty": "The diagram is empty.",
		"ai.error.unknownType": "Unknown diagram type: {type}",
		"ai.fake.title": "Diagram",
		"ai.draft.prompt": [
			"Create one Mermaid diagram from the request and the title and body of the content.",
			"- Answer with a single ```mermaid code fence only. Write nothing outside the fence",
			"- Pick the type that fits the request (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, etc.)",
			"- Write node text in the same language as the body, and wrap text containing parentheses, quotes or commas in double quotes",
			"- Do not invent facts that are not in the body",
		].join("\n"),
		"ai.edit.prompt": [
			"Edit the Mermaid diagram (```mermaid code fence) as requested.",
			"- Answer with the edited ```mermaid code fence only. Write nothing outside the fence",
			"- Leave the parts unrelated to the request as they are",
			"- If there is no request, fix syntax errors and tidy it up so it is easy to read",
		].join("\n"),
	},
	ko: {
		label: "다이어그램",
		description: "Mermaid 다이어그램·흐름도",
		keywords: "다이어그램,흐름도",
		placeholder: "Mermaid 다이어그램을 입력하세요",
		"ai.draft.label": "다이어그램 만들기",
		"ai.edit.label": "다이어그램 고치기",
		"ai.input.title": "제목",
		"ai.input.body": "지금 본문",
		"ai.input.block": "다이어그램",
		"ai.check.label": "Mermaid 문법",
		"ai.error.notFence": "```mermaid 코드 펜스 하나가 아닙니다.",
		"ai.error.empty": "다이어그램이 비었습니다.",
		"ai.error.unknownType": "알 수 없는 다이어그램 종류입니다: {type}",
		"ai.fake.title": "다이어그램",
	},
});
