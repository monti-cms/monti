import type { Prompter } from "../init-prompts";

/**
 * The questions of `monti import` use the prompter of `monti init` (`init-prompts.ts`, on `@clack/prompts`), so both commands ask the same way. The command runs
 * without one when it is not in a terminal or `--yes` is given: every question then takes its non-interactive answer.
 */

export type { Prompter };

export interface Choice<T extends string = string> {
	readonly label: string;
	readonly value: T;
}

/** Asks to pick one of the choices. The default is the one Enter takes. */
export function choose<T extends string>(
	prompter: Prompter,
	question: string,
	choices: readonly Choice<T>[],
	defaultIndex: number,
): Promise<T> {
	return prompter.select({
		message: question,
		options: choices.map((choice) => ({ value: choice.value, label: choice.label })),
		initial: (choices[defaultIndex] as Choice<T>).value,
	});
}

/** Asks a yes/no question. */
export function confirm(prompter: Prompter, question: string, defaultYes: boolean): Promise<boolean> {
	return prompter.confirm({ message: question, initial: defaultYes });
}

/**
 * A prompter that answers from a list, for tests. A choice is answered with its 1-based number and a yes/no with `y` or `n`; an empty answer takes the default.
 * `asked` has every question, `said` the text of the notes.
 */
export function scriptedPrompter(
	answers: readonly string[],
): Prompter & { readonly asked: string[]; readonly said: string[] } {
	const queue = [...answers];
	const asked: string[] = [];
	const said: string[] = [];
	const next = (message: string) => {
		asked.push(message);
		return queue.shift() ?? "";
	};
	return {
		asked,
		said,
		intro: (message) => {
			said.push(message);
		},
		outro: (message) => {
			said.push(message);
		},
		note: (body, title) => {
			said.push(title ? `${title}\n${body}` : body);
		},
		select: async (question) => {
			const answer = next(question.message);
			said.push(
				`${question.message}\n${question.options.map((option, index) => `${index + 1}. ${option.label}`).join("\n")}`,
			);
			const picked = Number(answer);
			if (answer !== "" && Number.isInteger(picked) && picked >= 1 && picked <= question.options.length) {
				return (question.options[picked - 1] as (typeof question.options)[number]).value;
			}
			return question.initial ?? (question.options[0] as (typeof question.options)[number]).value;
		},
		multiselect: async (question) => {
			next(question.message);
			return [...(question.initial ?? [])];
		},
		text: async (question) => next(question.message) || question.initial || "",
		confirm: async (question) => {
			const answer = next(question.message).toLowerCase();
			return answer === "" ? (question.initial ?? true) : answer === "y" || answer === "yes";
		},
	};
}
