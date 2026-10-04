import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, BLOCKS } from "../../blocks/active";
import { analyze } from "../analyze";

/** Public component name of a block that holds body content. Uses the site's added container block if there is one, otherwise the core block. */
const container = [...ADDED_BLOCKS, ...BLOCKS].find((block) => block.syntax.kind === "container" && !block.parent);
if (!container) throw new Error("analyze-security test: no container block");
const Box = container.component;

const errorCodes = (source: string) =>
	analyze(source)
		.errors.map((error) => error.code)
		.join(" | ");

/**
 * When `EVENT_HANDLER_NAME` was `/^on[A-Z]/`, `onerror` (lowercase) passed through.
 * React handles DOM attribute names case-insensitively, so lowercase handlers must be rejected too.
 */
describe("rejects JSX event handler attributes", () => {
	it("rejects event handler attributes regardless of case", () => {
		expect(errorCodes(`<${Box} onClick="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} onclick="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} onerror="x">a</${Box}>`)).toBe("event_handler_attribute");
		expect(errorCodes(`<${Box} ONERROR="x">a</${Box}>`)).toBe("event_handler_attribute");
	});

	it("lets attributes that are not event handlers through", () => {
		expect(errorCodes(`<${Box} title="t">a</${Box}>`)).toBe("");
	});
});
