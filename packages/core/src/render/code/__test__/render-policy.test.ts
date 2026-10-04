import { describe, expect, it } from "vitest";
import { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "../render-policy";

describe("render-policy", () => {
	it("config에서 inline/line wrapper render tag를 수집한다", () => {
		const tags = createAllowedRenderTagsFromConfig({
			annotations: [
				{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
				{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
			],
		});

		expect(tags).toEqual(["Tooltip", "Callout"]);
	});

	it("위험한 tag는 allowlist에서 제외한다", () => {
		expect(isSafeRenderTag("script")).toBe(false);
		expect(isSafeRenderTag("iframe")).toBe(false);
		expect(isSafeRenderTag("Tooltip")).toBe(true);

		const tags = createAllowedRenderTagsFromConfig({
			annotations: [
				{ name: "Danger", kind: "render", source: "mdx-text", render: "script", scopes: ["char"] },
				{ name: "Tooltip", kind: "render", render: "Tooltip", scopes: ["line"] },
			],
		});

		expect(tags).toEqual(["Tooltip"]);
	});
});
