import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, BLOCKS } from "../../blocks/active";
import { analyze } from "../analyze";

/** 본문을 담는 블록의 공개 컴포넌트 이름. 사이트가 더한 컨테이너 블록이 있으면 그것을, 없으면 본체 블록을 쓴다. */
const container = [...ADDED_BLOCKS, ...BLOCKS].find((block) => block.syntax.kind === "container" && !block.parent);
if (!container) throw new Error("analyze-security test: no container block");
const Box = container.component;

const errorCodes = (source: string) =>
	analyze(source)
		.errors.map((error) => error.code)
		.join(" | ");

/**
 * M7-SEC-1 P2: `EVENT_HANDLER_NAME`이 `/^on[A-Z]/`였을 때 `onerror`(소문자)가 통과했다.
 * React는 DOM 속성 이름을 대소문자와 무관하게 다루므로 소문자 핸들러도 거부해야 한다.
 */
describe("JSX 이벤트 핸들러 속성 거부", () => {
	it("대소문자와 무관하게 이벤트 핸들러 속성을 거부한다", () => {
		expect(errorCodes(`<${Box} onClick="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} onclick="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} onerror="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} ONERROR="x">a</${Box}>`)).toBe("event_handler_attribute");
	});

	it("이벤트 핸들러가 아닌 속성은 통과시킨다", () => {
		expect(errorCodes(`<${Box} title="t">a</${Box}>`)).toBe("");
	});
});
