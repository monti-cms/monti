import { parseArgs } from "node:util";
import { formatInitReport, initProject } from "./init.js";
import { createClackPrompter, InitCancelled } from "./init-prompts.js";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];
const options = {
    yes: { type: "boolean", short: "y" },
    json: { type: "boolean" },
    "dry-run": { type: "boolean" },
    "database-schema": { type: "string" },
    "admin-github-id": { type: "string" },
    "site-url": { type: "string" },
    locales: { type: "string" },
    locale: { type: "string" },
    "time-zone": { type: "string" },
    storage: { type: "string" },
    extras: { type: "string" },
    blocks: { type: "string" },
    "admin-path": { type: "string" },
    overwrite: { type: "boolean" },
    "no-install": { type: "boolean" },
    "package-manager": { type: "string" },
};
/** Runs `monti init <argv>` and returns the exit code: 0 done, 1 an error or a step that failed, 130 cancelled. */
export async function runInitCommand(argv, io, extras = {}) {
    const json = argv.includes("--json");
    try {
        const { values } = parseArgs({ args: [...argv], options });
        const manager = values["package-manager"];
        if (manager !== undefined && !PACKAGE_MANAGERS.includes(manager)) {
            throw new Error(`--package-manager "${manager}" must be one of ${PACKAGE_MANAGERS.join(", ")}`);
        }
        // Prompts only when a person is at the terminal and did not ask for none.
        const interactive = (extras.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)) && !values.yes && !json;
        const prompter = interactive ? (extras.prompter ?? (await createClackPrompter())) : undefined;
        const report = await initProject({
            cwd: io.cwd,
            prompter,
            dryRun: values["dry-run"],
            overwrite: values.overwrite,
            install: values["no-install"] ? false : undefined,
            packageManager: manager,
            databaseSchema: values["database-schema"],
            adminGithubId: values["admin-github-id"],
            siteUrl: values["site-url"],
            locales: values.locales ?? values.locale,
            timeZone: values["time-zone"],
            storage: values.storage,
            extras: values.extras,
            blocks: values.blocks,
            adminPath: values["admin-path"],
            log: json ? undefined : io.log,
            host: extras.host,
        });
        if (json) {
            io.log(JSON.stringify(report, null, 2));
        }
        else {
            io.log(formatInitReport(report));
            prompter?.outro(report.ok ? "Done." : "Done, with a problem (see above).");
        }
        return report.ok ? 0 : 1;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (json)
            io.log(JSON.stringify({ ok: false, error: message }, null, 2));
        else
            io.error(message);
        return error instanceof InitCancelled ? 130 : 1;
    }
}
