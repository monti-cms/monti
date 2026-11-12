import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { secretReader } from "./secret-input";

/** Standard input and the place prompts go, as the command has them. */
function terminal({ tty }: { tty: boolean }) {
	const input = Object.assign(new PassThrough(), { isTTY: tty });
	const prompts = new PassThrough();
	const written: string[] = [];
	prompts.on("data", (chunk: Buffer) => written.push(chunk.toString()));
	return { input, read: secretReader(input, prompts), written };
}

const within = <Value>(work: Promise<Value>, ms = 1000) =>
	Promise.race([work, new Promise<"never came">((resolve) => setTimeout(() => resolve("never came"), ms))]);

describe("a secret on standard input", () => {
	it("14-4 a key piped in without a final newline is read when the pipe ends, and nothing is asked", async () => {
		const { input, read, written } = terminal({ tty: false });
		const reading = read("secret");
		input.end("sk-piped-key-without-newline");
		expect(await within(reading)).toBe("sk-piped-key-without-newline");
		expect(written).toEqual([]);
	});

	it("14-4 a key piped in with a newline is the line, not the newline, and no prompt is written for the pipe", async () => {
		const { input, read, written } = terminal({ tty: false });
		const reading = read("secret");
		input.end("sk-piped-key-with-newline\r\n");
		expect(await within(reading)).toBe("sk-piped-key-with-newline");
		expect(written).toEqual([]);
	});

	it("a pipe that arrives in pieces is one key", async () => {
		const { input, read } = terminal({ tty: false });
		const reading = read("secret");
		input.write("sk-first-half-");
		input.write("second-half");
		input.end();
		expect(await within(reading)).toBe("sk-first-half-second-half");
	});

	it("two secrets piped in are two lines; one that was not sent is empty", async () => {
		const { input, read } = terminal({ tty: false });
		input.end("first\nsecond");
		expect(await read("one")).toBe("first");
		expect(await read("two")).toBe("second");
		expect(await read("three")).toBe("");
	});

	it("14-4 at a terminal the prompt goes where prompts go (standard error), and the typed line is the secret", async () => {
		const { input, read, written } = terminal({ tty: true });
		const reading = read("secret");
		input.write("sk-typed-at-the-prompt\n");
		expect(await within(reading)).toBe("sk-typed-at-the-prompt");
		expect(written.join("")).toBe("secret: ");
	});
});
