import { available, type Monti } from "../monti";
import { describeError } from "./errors";

export type CliIo = { out: (line: string) => void; err: (line: string) => void };

/** `--key value` pairs as an input object. A value that reads as JSON is JSON; a key given more than once is a list. */
function parseFlags(args: string[]): Record<string, unknown> {
	const input: Record<string, unknown> = {};
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (!flag.startsWith("--")) throw new Error(`Expected --name value, got "${flag}".`);
		const [name, inline] = flag.slice(2).split(/=(.*)/s, 2);
		const raw = inline ?? args[++index];
		if (raw === undefined) throw new Error(`--${name} has no value.`);
		let value: unknown = raw;
		try {
			value = JSON.parse(raw);
		} catch {}
		if (name === "input" && typeof value === "object" && value !== null) Object.assign(input, value);
		else if (name in input) input[name] = [...([] as unknown[]).concat(input[name]), value];
		else input[name] = value;
	}
	return input;
}

/**
 * Runs `monti <operation> [--input '<json>'] [--name value …]`: every read and write is a command, made from the operation list. Prints the result as
 * JSON and returns the exit code. Without an operation it lists them.
 */
export async function runCli(monti: Monti, argv: string[], io: CliIo): Promise<number> {
	const [name, ...rest] = argv;
	if (!name || name === "help") {
		for (const operation of monti.operations.values())
			if (available(operation, "cli", monti.site.files !== null)) io.out(`${operation.name}  ${operation.description}`);
		return 0;
	}
	try {
		const result = await monti.run(name, parseFlags(rest), { actor: "cli" });
		io.out(JSON.stringify(result, null, 2));
		return 0;
	} catch (error) {
		const described = describeError(error);
		if (!described && !(error instanceof Error)) throw error;
		io.err(JSON.stringify(described?.body ?? { error: (error as Error).message }, null, 2));
		return 1;
	}
}
