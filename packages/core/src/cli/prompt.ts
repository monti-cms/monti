/**
 * The prompt layer of the command line, shared by `monti init` and `monti admin:reset-password` (and any command that asks). The prompt library sits behind
 * {@link Prompter}, so a command is tested with scripted answers and the library is only loaded when a person is at the terminal.
 */

/** The prompts a command uses. */
export interface Prompter {
	intro(message: string): void;
	outro(message: string): void;
	/** A framed block of text (instructions, values to copy). */
	note(body: string, title?: string): void;
	select<T extends string>(question: {
		message: string;
		options: readonly { value: T; label: string; hint?: string }[];
		initial?: T;
	}): Promise<T>;
	multiselect<T extends string>(question: {
		message: string;
		options: readonly { value: T; label: string; hint?: string }[];
		initial?: readonly T[];
	}): Promise<T[]>;
	text(question: {
		message: string;
		placeholder?: string;
		initial?: string;
		validate?: (value: string) => string | undefined;
	}): Promise<string>;
	/** A secret: not echoed. */
	password(question: { message: string }): Promise<string>;
	confirm(question: { message: string; initial?: boolean }): Promise<boolean>;
	/** Runs one step of work behind a progress line (a spinner at the terminal), then prints how it ended. `work` must not throw and must not print. */
	task(title: string, work: () => Promise<TaskOutcome>): Promise<TaskOutcome>;
}

/** How a step ended: the line that replaces its progress line. */
export interface TaskOutcome {
	readonly status: "done" | "skipped" | "failed";
	readonly message: string;
}

/** Thrown when the person cancels a prompt (Ctrl+C). The command ends with exit code 130, the shell convention for an interrupt, and nothing was changed. */
export class Cancelled extends Error {
	constructor() {
		super("Cancelled. Nothing was written.");
		this.name = "Cancelled";
	}
}

/** Whether a person is at the terminal (both input and output are terminals). */
export const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/** The prompter for a person at the terminal, on `@clack/prompts` (loaded here, so non-interactive runs never load it). */
export async function createClackPrompter(): Promise<Prompter> {
	const clack = await import("@clack/prompts");
	const answer = <T>(value: T | symbol): T => {
		if (clack.isCancel(value)) throw new Cancelled();
		return value as T;
	};
	return {
		intro: (message) => clack.intro(message),
		outro: (message) => clack.outro(message),
		note: (body, title) => clack.note(body, title),
		select: async (question) =>
			answer(
				await clack.select({
					message: question.message,
					options: question.options.map((option) => ({ ...option })) as never,
					initialValue: question.initial as never,
				}),
			) as never,
		multiselect: async (question) =>
			answer(
				await clack.multiselect({
					message: question.message,
					options: question.options.map((option) => ({ ...option })) as never,
					initialValues: question.initial ? [...question.initial] : [],
					required: false,
				}),
			) as never,
		text: async (question) =>
			answer<string>(
				await clack.text({
					message: question.message,
					placeholder: question.placeholder,
					initialValue: question.initial,
					validate: question.validate ? (value) => question.validate?.(value ?? "") : undefined,
				}),
			),
		password: async (question) => answer<string>(await clack.password({ message: question.message })),
		confirm: async (question) =>
			answer<boolean>(await clack.confirm({ message: question.message, initialValue: question.initial })),
		task: async (title, work) => {
			const spinner = clack.spinner();
			spinner.start(title);
			const outcome = await work();
			if (outcome.status === "failed") spinner.error(outcome.message);
			else spinner.stop(outcome.message);
			return outcome;
		},
	};
}
