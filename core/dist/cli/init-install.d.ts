import type { InitAnswers } from "./init-answers.js";
import type { DetectedApp, PackageManager } from "./init-detect.js";
import type { InitHost, InitReport, InstallCommand } from "./init-types.js";
import type { Prompter } from "./prompt.js";
/** The install stage of `monti init`: which packages, the package manager commands, and running the install. */
/**
 * The libraries the admin shares with the app, which `@monti-cms/admin` (and the AI plugin and the blocks) declare as peer dependencies and so are not installed
 * with it. They must stay peers: React Query, next-themes, sonner, Tiptap and the lucide icons keep state in a module-level context or schema, so the admin, the plugins and
 * the app's own admin pages have to load one copy. `monti init` installs them with the Monti packages.
 */
export declare const ADMIN_PEER_PACKAGES: readonly ["next-themes", "@tanstack/react-query", "sonner", "@tiptap/core", "@tiptap/pm", "@tiptap/react", "lucide-react"];
/** The npm packages the answers need, besides what the app already lists. */
export declare function packagesFor(answers: InitAnswers): string[];
/** The real host: spawns the package manager. */
export declare const defaultInitHost: InitHost;
/** The package manager's command for `monti <args>` and for a package script. */
export declare const exec: (manager: PackageManager, args: string) => string;
export declare const script: (manager: PackageManager, name: string) => string;
export declare const addCommand: (manager: PackageManager, packages: readonly string[], cwd: string, dev?: boolean) => InstallCommand;
export declare const commandText: (command: InstallCommand) => string;
/**
 * The install specs of the Monti packages: while Monti is not on npm, `@monti-cms/core` is a GitHub address with `path:/core`, and each sibling is that address with its own folder.
 * With any other spec (or none) the names stay bare. Packages that are not Monti's stay bare.
 */
export declare function installSpecs(packages: readonly string[], coreSpec: string | undefined): string[];
/**
 * Installs the packages and records it in `report.steps`. A failure is recorded as failed (and `report.ok` turns false); running `monti init` again installs
 * what is still missing. Returns whether the packages are in place. Nothing here throws.
 */
export declare function runInstallStep(input: {
    readonly cwd: string;
    readonly host: InitHost;
    readonly log: (message: string) => void;
    readonly dryRun: boolean;
    readonly manager: PackageManager;
    readonly report: InitReport;
    /** Neither `--no-install` nor a "no" to the confirmation. */
    readonly installing: boolean;
    /** The person answered no to the confirmation. */
    readonly declined: boolean;
    readonly packages: readonly string[];
    /** What is passed to the package manager for each of `packages`. */
    readonly specs: readonly string[];
}): Promise<boolean>;
/** What gets installed, and whether it will be. */
export interface InstallPlan {
    /** The Monti packages (and the libraries they share with the app) the app does not list yet. */
    readonly missing: readonly string[];
    /** What is passed to the package manager for each of `missing`. */
    readonly specs: readonly string[];
    readonly command: InstallCommand;
    /** Neither `--no-install` nor a "no" to the confirmation. */
    readonly installing: boolean;
    /** The person answered no to the confirmation. */
    readonly declined: boolean;
}
/** Works out what is missing and whether the person agrees to run the install (default yes). `--yes`, `--json` and a missing terminal accept without asking. */
export declare function planInstall(input: {
    readonly cwd: string;
    readonly app: Pick<DetectedApp, "dependencies" | "coreSpec">;
    readonly answers: InitAnswers;
    readonly manager: PackageManager;
    /** `false` for `--no-install`. */
    readonly install: boolean | undefined;
    readonly dryRun: boolean;
    readonly prompter?: Prompter;
}): Promise<InstallPlan>;
