import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

/**
 * Reads secrets (a service key, a password) from standard input, one line each, for the commands that take none as an argument.
 *
 * Piped input is read to its end, so `printf '%s' "$KEY" | monti keys.add … --secret -` works with or without a final newline, and nothing is
 * asked: a pipe has nobody to read a prompt. At a terminal the prompt goes to `prompts` (standard error), never to standard output, where the
 * command's JSON goes: a prompt there would break `| jq`.
 */
export function secretReader(input: Readable & { isTTY?: boolean }, prompts: Writable) {
	let piped: Promise<string[]> | null = null;
	const lines = () => {
		piped ??= (async () => {
			const chunks: Buffer[] = [];
			for await (const chunk of input) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
			return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
		})();
		return piped;
	};
	return async (name: string): Promise<string> => {
		if (!input.isTTY) return (await lines()).shift() ?? "";
		const prompt = createInterface({ input, output: prompts, terminal: false });
		try {
			return await prompt.question(`${name}: `);
		} finally {
			prompt.close();
		}
	};
}
