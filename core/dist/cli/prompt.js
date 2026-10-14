/**
 * The prompt layer of the command line, shared by `monti init` and `monti admin:reset-password` (and any command that asks). The prompt library sits behind
 * {@link Prompter}, so a command is tested with scripted answers and the library is only loaded when a person is at the terminal.
 */
/** Thrown when the person cancels a prompt (Ctrl+C). The command ends with exit code 130, the shell convention for an interrupt, and nothing was changed. */
export class Cancelled extends Error {
    constructor() {
        super("Cancelled. Nothing was written.");
        this.name = "Cancelled";
    }
}
/** Whether a person is at the terminal (both input and output are terminals). */
export const isInteractive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);
/** The prompter for a person at the terminal, on `@clack/prompts` (loaded here, so non-interactive runs never load it). */
export async function createClackPrompter() {
    const clack = await import("@clack/prompts");
    const answer = (value) => {
        if (clack.isCancel(value))
            throw new Cancelled();
        return value;
    };
    return {
        intro: (message) => clack.intro(message),
        outro: (message) => clack.outro(message),
        note: (body, title) => clack.note(body, title),
        select: async (question) => answer(await clack.select({
            message: question.message,
            options: question.options.map((option) => ({ ...option })),
            initialValue: question.initial,
        })),
        multiselect: async (question) => answer(await clack.multiselect({
            message: question.message,
            options: question.options.map((option) => ({ ...option })),
            initialValues: question.initial ? [...question.initial] : [],
            required: false,
        })),
        text: async (question) => answer(await clack.text({
            message: question.message,
            placeholder: question.placeholder,
            initialValue: question.initial,
            validate: question.validate ? (value) => question.validate?.(value ?? "") : undefined,
        })),
        password: async (question) => answer(await clack.password({ message: question.message })),
        confirm: async (question) => answer(await clack.confirm({ message: question.message, initialValue: question.initial })),
    };
}
