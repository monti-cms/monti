import { createInterface } from "node:readline/promises";

/**
 * The questions of `monti import`. A prompter asks one line at a time; the helpers on top turn it into a choice and a yes/no. The command runs without one
 * when it is not in a terminal or `--yes` is given: every question then takes its non-interactive answer.
 */
export interface Prompter {
	/** Asks a question and returns the answer line (trimmed). */
	ask(question: string): Promise<string>;
	/** Writes a line that is not a question. */
	say(line: string): void;
	close?(): void;
}

/** A prompter over a terminal. */
export function terminalPrompter(
	input: NodeJS.ReadableStream = process.stdin,
	output: NodeJS.WritableStream = process.stdout,
): Prompter {
	const rl = createInterface({ input, output });
	return {
		ask: async (question) => (await rl.question(question)).trim(),
		say: (line) => {
			output.write(`${line}\n`);
		},
		close: () => rl.close(),
	};
}

/** A prompter that answers from a list, for tests. An answer of `undefined` accepts the default. */
export function scriptedPrompter(
	answers: readonly string[],
): Prompter & { readonly asked: string[]; readonly said: string[] } {
	const queue = [...answers];
	const asked: string[] = [];
	const said: string[] = [];
	return {
		asked,
		said,
		ask: async (question) => {
			asked.push(question);
			return queue.shift() ?? "";
		},
		say: (line) => {
			said.push(line);
		},
	};
}

export interface Choice<T extends string = string> {
	readonly label: string;
	readonly value: T;
}

/**
 * Asks to pick one of the choices by number. Enter takes `defaultIndex`. An answer that is not a choice asks again (three times, then the default is taken).
 */
export async function choose<T extends string>(
	prompter: Prompter,
	question: string,
	choices: readonly Choice<T>[],
	defaultIndex: number,
): Promise<T> {
	prompter.say(question);
	choices.forEach((choice, index) => {
		prompter.say(`  ${index + 1}. ${choice.label}${index === defaultIndex ? "  (default)" : ""}`);
	});
	for (let attempt = 0; attempt < 3; attempt++) {
		const answer = await prompter.ask(`Choose 1-${choices.length} [${defaultIndex + 1}]: `);
		if (answer === "") break;
		const picked = Number(answer);
		if (Number.isInteger(picked) && picked >= 1 && picked <= choices.length)
			return (choices[picked - 1] as Choice<T>).value;
		prompter.say(`  "${answer}" is not one of the choices.`);
	}
	return (choices[defaultIndex] as Choice<T>).value;
}

/** Asks a yes/no question. Enter takes `defaultYes`. */
export async function confirm(prompter: Prompter, question: string, defaultYes: boolean): Promise<boolean> {
	const answer = (await prompter.ask(`${question} [${defaultYes ? "Y/n" : "y/N"}] `)).toLowerCase();
	if (answer === "") return defaultYes;
	return answer === "y" || answer === "yes";
}
