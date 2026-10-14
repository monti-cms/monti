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
        options: readonly {
            value: T;
            label: string;
            hint?: string;
        }[];
        initial?: T;
    }): Promise<T>;
    multiselect<T extends string>(question: {
        message: string;
        options: readonly {
            value: T;
            label: string;
            hint?: string;
        }[];
        initial?: readonly T[];
    }): Promise<T[]>;
    text(question: {
        message: string;
        placeholder?: string;
        initial?: string;
        validate?: (value: string) => string | undefined;
    }): Promise<string>;
    /** A secret: not echoed. */
    password(question: {
        message: string;
    }): Promise<string>;
    confirm(question: {
        message: string;
        initial?: boolean;
    }): Promise<boolean>;
}
/** Thrown when the person cancels a prompt (Ctrl+C). The command ends with exit code 130, the shell convention for an interrupt, and nothing was changed. */
export declare class Cancelled extends Error {
    constructor();
}
/** Whether a person is at the terminal (both input and output are terminals). */
export declare const isInteractive: () => boolean;
/** The prompter for a person at the terminal, on `@clack/prompts` (loaded here, so non-interactive runs never load it). */
export declare function createClackPrompter(): Promise<Prompter>;
