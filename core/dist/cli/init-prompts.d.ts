import { type InitAnswers } from "./init-answers.js";
import type { DetectedApp } from "./init-detect.js";
import type { Prompter } from "./prompt.js";
/**
 * The questions of `monti init`. Each one has a flag; a question whose flag is given is not asked, and without a terminal (or with `--yes`) every unanswered
 * question takes its default. The prompt library sits behind {@link Prompter}, so the flow is tested with scripted answers and the library is only loaded
 * when a person is at the terminal.
 */
/** The raw flag values (strings as typed). `undefined` means the flag was not given. */
export interface InitAnswerFlags {
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
    /** `password` or `github`. */
    readonly login?: string;
    /** `--directive-syntax` (true) or `--no-directive-syntax` (false): write blocks as `:::callout` (the directive syntax), without asking. */
    readonly directiveSyntax?: boolean;
}
/** The time zone of this computer (what the OS says, as an IANA name), or `undefined` when it cannot be read. */
export declare const detectSystemTimeZone: () => string | undefined;
/** Checks every flag that was given, before anything is asked. */
export declare function validateFlags(flags: InitAnswerFlags): void;
/** What the questions ask, for the tests and the docs. */
export declare const QUESTIONS: {
    readonly defaultLocale: "Default language of the site";
    readonly otherLocales: "Other languages (optional)";
    readonly localesOther: "Language code (or several, comma-separated, like pt-BR or sv)";
    readonly storage: "Where should uploaded images go?";
    readonly extras: "Extra features";
    readonly blocks: "Which body blocks do you want?";
    readonly blockList: "Pick the blocks";
    readonly adminPath: "Where should the admin live?";
    readonly login: "How should people sign in to the admin?";
    readonly directive: "How are blocks written in Markdown?";
};
/** The languages found in the names of the content files (`hello.ko.mdx`) or in language folders (`ko/`), default first, and where they were found. */
export declare function detectedLocales(app: DetectedApp): {
    codes: string[];
    dir: string;
    from: "filename" | "folder";
} | undefined;
/**
 * Settles every question: from its flag when given, by asking when `prompter` is there, else with the default. Throws {@link Cancelled} when the
 * person cancels, and an Error naming the flag when a flag value is wrong.
 */
export declare function collectAnswers(app: DetectedApp, flags: InitAnswerFlags, prompter?: Prompter, systemTimeZone?: () => string | undefined): Promise<InitAnswers>;
