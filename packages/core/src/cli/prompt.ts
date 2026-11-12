import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

/** Thrown when the person leaves a question (Ctrl+C, the end of input): the command stops and nothing was written. */
export class Cancelled extends Error {
	constructor() {
		super("Cancelled. Nothing was written.");
		this.name = "Cancelled";
	}
}

/** A question on one line, with the answer Enter gives in brackets. `check` returns what is wrong with an answer, and the question is asked again. */
export type Ask = (question: {
	message: string;
	initial: string;
	check?: (answer: string) => string | null;
}) => Promise<string>;

/**
 * Questions for a person at a terminal: one line each, on Node's own readline (no prompt library: `monti init` asks four things). Ctrl+C or
 * the end of input throws {@link Cancelled}.
 */
export function terminalAsk(input: Readable, output: Writable): { ask: Ask; close: () => void } {
	const lines = createInterface({ input, output });
	let closed = false;
	lines.once("close", () => {
		closed = true;
	});
	const ask: Ask = async ({ message, initial, check }) => {
		for (;;) {
			if (closed) throw new Cancelled();
			const leave = new AbortController();
			const left = () => leave.abort();
			lines.once("close", left);
			lines.once("SIGINT", left);
			let typed: string;
			try {
				typed = await lines.question(`${message} [${initial}]: `, { signal: leave.signal });
			} catch {
				throw new Cancelled();
			} finally {
				lines.off("close", left);
				lines.off("SIGINT", left);
			}
			const answer = typed.trim() === "" ? initial : typed.trim();
			const wrong = check?.(answer) ?? null;
			if (wrong === null) return answer;
			output.write(`  ${wrong}\n`);
		}
	};
	return { ask, close: () => lines.close() };
}
