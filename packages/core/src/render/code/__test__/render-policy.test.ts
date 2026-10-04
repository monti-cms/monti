import { describe, expect, it } from "vitest";
import { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "../render-policy";

describe("render-policy", () => {
	it("collects inline/line wrapper render tags from config", () => {
		const tags = createAllowedRenderTagsFromConfig({
			annotations: [
				{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
				{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
			],
		});

		expect(tags).toEqual(["Tooltip", "Callout"]);
	});

	it("excludes dangerous tags from the allowlist", () => {
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
