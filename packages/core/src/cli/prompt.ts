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
 * the end of input throws {@link Cancelled}. The terminal is held only while a question waits: between questions it is the shell's own, so
 * Ctrl+C during the work that follows (a database being set up) ends the command as it does any other.
 */
export function terminalAsk(input: Readable, output: Writable): Ask {
	return async ({ message, initial, check }) => {
		for (;;) {
			if (input.readableEnded || input.destroyed) throw new Cancelled();
			const lines = createInterface({ input, output });
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
				lines.close();
			}
			const answer = typed.trim() === "" ? initial : typed.trim();
			const wrong = check?.(answer) ?? null;
			if (wrong === null) return answer;
			output.write(`  ${wrong}\n`);
		}
	};
}
