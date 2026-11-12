import { available, type Monti } from "../monti";
import { describeError } from "./errors";

export type CliIo = {
	out: (line: string) => void;
	err: (line: string) => void;
	/** Reads one secret (a service key) from standard input, asked for by its input's name. Without it no command takes a secret. */
	secret?: (name: string) => Promise<string>;
};

/** How a secret input is given on the command line: `--secret -`, then the secret on standard input. */
const FROM_STANDARD_INPUT = "-";

type Flag = { name: string; raw: string };

/**
 * The arguments as `--name value` pairs, in order. An error names an argument by its place and never by what was typed: an error that echoes the
 * command line echoes a key someone put on it by mistake.
 */
function flagsOf(args: string[]): Flag[] {
	const flags: Flag[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (!flag.startsWith("--"))
			throw new Error(`Argument ${index + 1} is not a --name: arguments come as --name value.`);
		const [name, inline] = flag.slice(2).split(/=(.*)/s, 2);
		const raw = inline ?? args[++index];
		if (raw === undefined) throw new Error(`Argument ${index} has no value: arguments come as --name value.`);
		flags.push({ name, raw });
	}
	return flags;
}

const parsed = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The pairs as an input object. A value that reads as JSON is JSON; a key given more than once is a list; `--input` gives the object itself. */
function inputOf(flags: Flag[]): Record<string, unknown> {
	const input: Record<string, unknown> = {};
	for (const { name, raw } of flags) {
		const value = parsed(raw);
		if (name === "input" && typeof value === "object" && value !== null) Object.assign(input, value);
		else if (name in input) input[name] = [...([] as unknown[]).concat(input[name]), value];
		else input[name] = value;
	}
	return input;
}

/**
 * Whether a secret input was put on the command line, looked at on the arguments as they were typed, before anything is merged: its one allowed
 * form is `--secret -`, once, and never inside `--input`.
 */
function secretOnTheLine(flags: Flag[], secret: string): "none" | "standard input" | "typed" {
	const given = flags.filter((flag) => flag.name === secret);
	const inJson = flags.some((flag) => {
		const value = flag.name === "input" ? parsed(flag.raw) : null;
		return isObject(value) && secret in value;
	});
	if (inJson || given.length > 1 || given.some((flag) => flag.raw !== FROM_STANDARD_INPUT)) return "typed";
	return given.length === 1 ? "standard input" : "none";
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
		for (const stream of monti.streams.values()) io.out(`${stream.name}  ${stream.description}`);
		return 0;
	}
	try {
		const flags = flagsOf(rest);
		// A secret (a service key) is never an argument: the shell's history and the process list would keep it. `--secret -` reads it instead.
		const secrets = monti.operations.get(name)?.secretInputs ?? [];
		const fromStandardInput: string[] = [];
		for (const secret of secrets) {
			const how = secretOnTheLine(flags, secret);
			if (how === "typed" || (how === "standard input" && !io.secret)) {
				io.err(
					JSON.stringify(
						{ error: `--${secret} is not given as an argument: write --${secret} - and give it on standard input.` },
						null,
						2,
					),
				);
				return 1;
			}
			if (how === "standard input") fromStandardInput.push(secret);
		}
		const input = inputOf(flags);
		for (const secret of fromStandardInput) input[secret] = await io.secret?.(secret);
		// A stream is a command too: its events are printed as they come, one JSON object per line.
		if (monti.streams.has(name)) {
			const events = monti.stream(name, input, { actor: "cli", session: null, signal: new AbortController().signal });
			for await (const event of events) io.out(JSON.stringify(event));
			return 0;
		}
		const result = await monti.run(name, input, { actor: "cli" });
		io.out(JSON.stringify(result, null, 2));
		return 0;
	} catch (error) {
		const described = describeError(error);
		if (!described && !(error instanceof Error)) throw error;
		io.err(JSON.stringify(described?.body ?? { error: (error as Error).message }, null, 2));
		return 1;
	}
}
