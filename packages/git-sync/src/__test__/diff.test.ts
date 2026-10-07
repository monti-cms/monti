import { describe, expect, it } from "vitest";
import { lineDiff } from "../diff";

const compact = (before: string, after: string) =>
	lineDiff(before, after).map((line) => `${line.type === "same" ? " " : line.type === "add" ? "+" : "-"}${line.text}`);

describe("line diff", () => {
	it("is all unchanged lines for equal texts", () => {
		expect(compact("a\nb\n", "a\nb\n")).toEqual([" a", " b"]);
	});

	it("marks lines only in the first text as removed and lines only in the second as added", () => {
		expect(compact("title: Server\nbody\n", "title: Git\nbody\n")).toEqual(["-title: Server", "+title: Git", " body"]);
	});

	it("finds the common lines around an insertion and a deletion", () => {
		expect(compact("a\nb\nc\nd\n", "a\nc\nd\ne\n")).toEqual([" a", "-b", " c", " d", "+e"]);
	});

	it("handles an empty side (an entry removed on the server)", () => {
		expect(compact("", "x\ny")).toEqual(["+x", "+y"]);
		expect(compact("x\ny", "")).toEqual(["-x", "-y"]);
		expect(lineDiff("", "")).toEqual([]);
	});

	it("ignores the difference between line endings and a final newline", () => {
		expect(lineDiff("a\r\nb", "a\nb\n").every((line) => line.type === "same")).toBe(true);
	});

	it("does not build a huge table for two big texts that differ everywhere", () => {
		const big = (prefix: string) => Array.from({ length: 3000 }, (_, index) => `${prefix}${index}`).join("\n");
		const diff = lineDiff(big("a"), big("b"));
		expect(diff.filter((line) => line.type === "remove")).toHaveLength(3000);
		expect(diff.filter((line) => line.type === "add")).toHaveLength(3000);
	});
});
