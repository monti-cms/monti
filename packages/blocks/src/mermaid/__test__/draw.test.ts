import { afterEach, describe, expect, it, vi } from "vitest";
import { drawMermaid } from "../draw";

afterEach(() => {
	document.body.innerHTML = "";
});

/** Mermaid appends `#d<id>` (with its error graphic) to the body when a render fails. */
const bomb = (id: string) => {
	const element = document.createElement("div");
	element.id = `d${id}`;
	document.body.append(element);
};

describe("drawMermaid", () => {
	it("returns the svg of a valid diagram", async () => {
		const render = vi.fn(async () => ({ svg: "<svg/>" }));
		expect(await drawMermaid({ parse: async () => true, render }, "m1", "graph TD\n A-->B")).toBe("<svg/>");
	});

	it("throws the syntax error without rendering, so nothing is added to the page", async () => {
		const render = vi.fn(async () => ({ svg: "" }));
		const parse = async () => {
			throw new Error("Parse error on line 2");
		};
		await expect(drawMermaid({ parse, render }, "m2", "graph TD\n A-->")).rejects.toThrow("Parse error");
		expect(render).not.toHaveBeenCalled();
		expect(document.body.children).toHaveLength(0);
	});

	it("removes the error graphic mermaid leaves behind when a render fails", async () => {
		const render = async () => {
			bomb("m3");
			throw new Error("render failed");
		};
		await expect(drawMermaid({ parse: async () => true, render }, "m3", "x")).rejects.toThrow("render failed");
		expect(document.getElementById("dm3")).toBeNull();
	});
});
