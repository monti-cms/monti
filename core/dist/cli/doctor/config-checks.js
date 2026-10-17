import { readFileSync } from "node:fs";
import path from "node:path";
import { hostOf } from "../../cms/host.js";
import { SetupError } from "../../core/problem.js";
import { formatDecision } from "../../server/decision.js";
import { findBoundaryViolations } from "../import-boundary.js";
import { gitignoreCoverage } from "../next-app.js";
import { fail, fromProblem, ok, skip, warn } from "./outcome.js";
import { exists, messageOf } from "./types.js";
/** The `config` group of `monti doctor`: env files, the config file and what it holds. */
const envFiles = {
    group: "config",
    id: "env-files",
    title: "Env files",
    run: (state) => {
        if (state.envError) {
            return fail(state.envError.message, {
                where: "the --env-file option",
                fix: "create the file or correct the path, or use --no-env-file to read none",
            });
        }
        return state.envFiles.length > 0
            ? ok(`read ${state.envFiles.join(", ")}`)
            : ok("no .env.local or .env here, so only the environment of the shell is used");
    },
};
const envIgnored = {
    group: "config",
    id: "env-ignored",
    title: ".env.local kept out of git",
    run: (state) => {
        if (!exists(state, ".env.local"))
            return skip("not checked: there is no .env.local");
        if (!exists(state, ".gitignore"))
            return skip("not checked: there is no .gitignore in this folder");
        const covered = gitignoreCoverage(readFileSync(path.join(state.cwd, ".gitignore"), "utf8"));
        if (covered.envLocal && covered.montiFolder)
            return ok(".env.local and .monti/ are in .gitignore");
        if (!covered.envLocal) {
            return warn(".env.local holds secrets (MONTI_SECRET, the database URL) but .gitignore does not list it", {
                where: ".gitignore",
                fix: "add a line `.env.local` to .gitignore; if it was already committed, rotate the secrets in it",
            });
        }
        return warn("the .monti/ folder, where `monti db:migrate` writes its logs, is not in .gitignore", {
            where: ".gitignore",
            fix: "add a line `.monti/` to .gitignore",
        });
    },
};
const configFile = {
    group: "config",
    id: "file",
    title: "Config file",
    run: (state) => {
        if (state.configPath)
            return ok(state.configPath);
        // The lookup says what is missing and how to fix it (a wrong --config or MONTI_CONFIG_PATH, or no file at all).
        if (state.configError instanceof SetupError)
            return fromProblem("fail", state.configError.problem);
        return fail("no monti.config.ts found", {
            where: `${state.cwd} (also looked under src/)`,
            fix: "run `monti` from the folder of your Next app; `monti init` creates the config file in an app that has none",
        });
    },
};
/** The first `Cannot find package 'x'` of a load error. */
const missingPackage = (error) => /Cannot find (?:package|module) '([^']+)'/.exec(messageOf(error))?.[1];
const configLoads = {
    group: "config",
    id: "loads",
    title: "Config loads",
    run: (state) => {
        if (!state.configPath)
            return skip("not checked: no config file (see above)");
        if (state.cms) {
            return ok(`${state.configPath} loads and exports the CMS instance (${state.cms.site.plugins.length} plugins)`);
        }
        const message = messageOf(state.loadError);
        const missing = missingPackage(state.loadError);
        return fail(`${state.configPath} did not load: ${message.split("\n")[0]}`, {
            where: state.configPath,
            fix: missing
                ? `install the package it imports (\`${missing.startsWith(".") ? "check the path of the import" : `add ${missing} with your package manager`}\`), then run \`monti doctor\` again`
                : "fix the error above in the config file (the full message is printed by `monti db:migrate`), then run `monti doctor` again",
        });
    },
};
/** Provenance: every value Monti picked on its own, with where it came from (`set in monti.config.ts`, `from env X`, or `auto-detected (reason)`). */
const automatic = {
    group: "config",
    id: "automatic",
    title: "What Monti decided on its own",
    needsCms: true,
    run: (state) => {
        const decisions = state.cms ? hostOf(state.cms).decisions(state.env) : [];
        return ok(decisions.map((decision) => `${formatDecision(decision)}`).join("\n"));
    },
};
const boundary = {
    group: "config",
    id: "boundary",
    title: "No client code imports the config",
    run: (state) => {
        let violations;
        try {
            violations = findBoundaryViolations(state.cwd);
        }
        catch (error) {
            return fail(`could not read the source files: ${messageOf(error)}`, {
                where: state.cwd,
                fix: "run `monti doctor` in the folder of your app",
            });
        }
        if (violations.length === 0)
            return ok('no "use client" file imports monti.config.ts or server-only code');
        const shown = violations.slice(0, 6).map((violation) => `${violation.chain.join(" -> ")}`);
        const more = violations.length > shown.length ? [`... and ${violations.length - shown.length} more`] : [];
        return fail(`${violations.length} import chain${violations.length === 1 ? "" : "s"} from a client component reach${violations.length === 1 ? "es" : ""} server-only code:\n${[...shown, ...more].join("\n")}`, {
            where: [...new Set(violations.map((violation) => violation.client))].slice(0, 4).join(", "),
            fix: "monti.config.ts holds the database and login settings and must stay on the server. Import it from a server file instead (a server component, a route file, a script); a client component gets data as props or through the API route",
        });
    },
};
/**
 * The media storage settings. The public pages hide a storage problem on purpose (an image whose address cannot be made is drawn as "unavailable", the page
 * still renders), so a missing `S3_*` value would otherwise show up only as images that are gone. This builds the store the way the first upload or read does.
 */
const storageConfigured = {
    group: "config",
    id: "storage",
    title: "Media storage",
    needsCms: true,
    run: (state) => {
        if (!state.cms?.server.media)
            return ok("no `storage` in the config, so uploads are off and the media menu is hidden");
        try {
            state.cms.mediaStore().getPublicUrl("monti-doctor");
        }
        catch (error) {
            // Setup errors carry their problem; so do the errors of plugins' stores.
            const problem = error?.problem;
            return fail(problem?.what ?? messageOf(error).split("\n")[0] ?? "the media storage cannot be set up", {
                where: problem?.where ?? "`storage` in monti.config.ts",
                fix: `${problem?.fix ?? "fix the storage settings"}\nuntil then every image on the public pages is drawn as unavailable`,
            });
        }
        return ok("the media storage is set up, and public file addresses can be made");
    },
};
/** The checks of the `config` group, in the order they are listed. */
export const CONFIG_CHECKS = [
    envFiles,
    envIgnored,
    configFile,
    configLoads,
    automatic,
    boundary,
    storageConfigured,
];
