import type { DetectedApp } from "./init-detect.js";
import { type InitAnswers } from "./templates.js";
/**
 * The questions of `monti init`. Each one has a flag; a question whose flag is given is not asked, and without a terminal (or with `--yes`) every unanswered
 * question takes its default. The prompt library sits behind {@link Prompter}, so the flow is tested with scripted answers and the library is only loaded
 * when a person is at the terminal.
 */
/** The prompts the flow uses. */
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
    confirm(question: {
        message: string;
        initial?: boolean;
    }): Promise<boolean>;
}
/** Thrown when the person cancels a prompt (Ctrl+C). Nothing has been written at that point. */
export declare class InitCancelled extends Error {
    constructor();
}
/** The raw flag values (strings as typed). `undefined` means the flag was not given. */
export interface InitAnswerFlags {
    /** The Postgres schema for the tables, as an example value in `.env.example` (`DATABASE_SCHEMA`). */
    readonly databaseSchema?: string;
    /** The numeric GitHub id of the admin, filled in `.env.example` (`MONTI_ADMIN_GITHUB_ID`). */
    readonly adminGithubId?: string;
    readonly siteUrl?: string;
    /** Comma-separated locale codes, the default first. */
    readonly locales?: string;
    readonly timeZone?: string;
    /** `s3` or `none`. */
    readonly storage?: string;
    /** Comma-separated: `ai`, `git-sync`, or `none`. */
    readonly extras?: string;
    /** `all`, `none`, `default` (the light set) or comma-separated block names. */
    readonly blocks?: string;
    readonly adminPath?: string;
}
/** An admin path becomes a folder in the app, so it is plain path segments only. */
export declare const validAdminPath: (value: string) => boolean;
/** Checks every flag that was given, before anything is asked. */
export declare function validateFlags(flags: InitAnswerFlags): void;
/** What the questions ask, for the tests and the docs. */
export declare const QUESTIONS: {
    readonly databaseSchema: "Postgres schema for the tables (empty: public). Use one when the database is shared with other apps. Goes in .env.example";
    readonly adminGithubId: "Your numeric GitHub id (MONTI_ADMIN_GITHUB_ID in .env.example). Leave empty to fill it in later";
    readonly locales: "Languages of the site (comma-separated, the default first)";
    readonly storage: "Where should uploaded images go?";
    readonly extras: "Extra features";
    readonly blocks: "Which body blocks do you want?";
    readonly blockList: "Pick the blocks";
    readonly adminPath: "Where should the admin live?";
};
/** The languages found in the names of the content files (`hello.ko.mdx`) or in language folders (`ko/`), default first, and where they were found. */
export declare function detectedLocales(app: DetectedApp): {
    codes: string[];
    dir: string;
    from: "filename" | "folder";
} | undefined;
/**
 * Settles every question: from its flag when given, by asking when `prompter` is there, else with the default. Throws {@link InitCancelled} when the
 * person cancels, and an Error naming the flag when a flag value is wrong.
 */
export declare function collectAnswers(app: DetectedApp, flags: InitAnswerFlags, prompter?: Prompter): Promise<InitAnswers>;
/** The prompter for a person at the terminal, on `@clack/prompts` (loaded here, so non-interactive runs never load it). */
export declare function createClackPrompter(): Promise<Prompter>;
