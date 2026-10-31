import { describe, expect, it } from "vitest";
import { problemError } from "../../core/problem";
import { exitCodeFor, reportError } from "../exit";
import { runCli } from "../index";
import { Cancelled } from "../prompt";

const capture = () => {
	const out: string[] = [];
	const err: string[] = [];
	return { out, err, io: { cwd: process.cwd(), log: (m: string) => out.push(m), error: (m: string) => err.push(m) } };
};

describe("one place turns an error into an exit code", () => {
	it("CLI-E1 a cancelled question ends with 130, any other error with 1", () => {
		expect(exitCodeFor(new Cancelled())).toBe(130);
		expect(exitCodeFor(problemError({ what: "x", fix: "y" }))).toBe(1);
		expect(exitCodeFor(new Error("boom"))).toBe(1);
		expect(exitCodeFor("a string")).toBe(1);
	});

	it("CLI-E1 prints the message to error, or as JSON to log with --json", () => {
		const text = capture();
		expect(reportError(new Error("boom"), text.io)).toBe(1);
		expect(text.err).toEqual(["boom"]);
		expect(text.out).toEqual([]);

		const json = capture();
		expect(reportError(new Cancelled(), json.io, { json: true })).toBe(130);
		expect(JSON.parse(json.out.join(""))).toMatchObject({ ok: false, error: expect.any(String) });
		expect(json.err).toEqual([]);
	});

	it("CLI-E1 every command ends through it: an unknown option is exit 1, and JSON stays JSON", async () => {
		for (const command of [
			"init",
			"db:setup",
			"db:migrate",
			"events:retry",
			"doctor",
			"schema:extract",
			"schema:diff",
		]) {
			const plain = capture();
			expect(await runCli([command, "--no-such-option"], plain.io)).toBe(1);
			expect(plain.err.join("\n")).toContain("no-such-option");
		}
		const json = capture();
		expect(await runCli(["doctor", "--json", "--no-such-option"], json.io)).toBe(1);
		expect(JSON.parse(json.out.join("")).ok).toBe(false);
	});
});
