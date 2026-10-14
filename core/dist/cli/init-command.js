import { defineCommand } from "./command.js";
import { initProject } from "./init.js";
import { formatInitReport } from "./init-report.js";
import { createClackPrompter, isInteractive } from "./prompt.js";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];
/** The `monti init` command line: flags in, the report out. Exit codes: 0 done, 1 an error or a step that failed, 130 cancelled (see `exit.ts`). */
export const initCommand = defineCommand({
    name: "init",
    summary: `Add Monti to an existing Next app (App Router): asks a few questions, writes Monti's own new files (monti.config.ts, monti.schema.ts, the
admin pages, the API route and a commented .env.example), installs the packages, and prints what is left (.env.local, db:setup).
It makes edits to your own files and lists them under "Changed:": it wraps the export of next.config in withCms(), adds suppressHydrationWarning to the <html> of
the root layout, and adds .env.local and .monti/ to .gitignore (a file in a shape it cannot edit safely is left alone and the step is in the list).
It writes no .env.local. A file that already exists is never overwritten without a yes.
Every question has a flag; with --yes, --json, or no terminal nothing is asked.`,
    options: {
        yes: {
            type: "boolean",
            short: "y",
            help: "Take the default for every question that has no flag, and run the package install without asking",
        },
        json: { type: "boolean", help: "Print the result as JSON (implies --yes)" },
        "dry-run": { type: "boolean", help: "Show what would be written and run, and change nothing" },
        "site-url": {
            type: "string",
            value: "<url>",
            help: "Public site URL, for the SITE_URL example in .env.example (default http://localhost:3000)",
        },
        locales: {
            type: "string",
            value: "<list>",
            help: "Language codes, the default first (default: the languages found in file names like hello.ko.mdx or in folders like ko/, else en)",
        },
        locale: { type: "string", value: "<code>", help: "The same as --locales, for one language" },
        "time-zone": {
            type: "string",
            value: "<tz>",
            help: "IANA time zone for dates and times (default: this computer's)",
        },
        storage: {
            type: "string",
            value: "<s3|none>",
            help: "Image storage: an S3-compatible store (S3, R2, MinIO), or none for now (default none)",
        },
        extras: { type: "string", value: "<list>", help: "ai, git-sync, or none (default none)" },
        blocks: {
            type: "string",
            value: "<list>",
            help: `default, all, none, or block names: callout, collapsible, tabs, columns, code-explorer, mermaid, chart, tooltip, code-ref, color
(default: the light set, callout, collapsible, tabs, code-ref and color. mermaid adds about 26 MB of packages and chart adds
recharts, so both are opt-in: name them, or pass all)`,
        },
        login: {
            type: "string",
            value: "<password|github>",
            help: `How people sign in to the admin: the built-in email and password login (default), or GitHub (needs an OAuth app).
The first one is created on the admin screen; GitHub's values go in .env.local`,
        },
        "admin-path": { type: "string", value: "<path>", help: "Admin screen path (default /studio)" },
        "directive-syntax": {
            type: "boolean",
            help: `Write blocks as ::: blocks (:::callout, :::tabs) with @monti-cms/syntax-directive, without asking. Without it and without
--no-directive-syntax: asked, and the default is yes when blocks are installed`,
        },
        "no-directive-syntax": { type: "boolean", help: "Keep plain MDX for the blocks, without asking" },
        overwrite: { type: "boolean", help: "Replace existing files that differ (default: keep them)" },
        "no-install": {
            type: "boolean",
            help: "Do not install packages: the install command is printed in the list of what is left",
        },
        "package-manager": { type: "string", value: "<m>", help: "npm, pnpm, yarn or bun (default: detected)" },
    },
    run: async (context) => {
        const { values } = context;
        const manager = values["package-manager"];
        if (manager !== undefined && !PACKAGE_MANAGERS.includes(manager)) {
            throw new Error(`--package-manager "${manager}" must be one of ${PACKAGE_MANAGERS.join(", ")}`);
        }
        // Prompts only when a person is at the terminal and did not ask for none.
        const interactive = (context.interactive ?? isInteractive()) && !values.yes && !values.json;
        const prompter = interactive ? (context.prompter ?? (await createClackPrompter())) : undefined;
        const report = await initProject({
            cwd: context.cwd,
            prompter,
            dryRun: values["dry-run"],
            overwrite: values.overwrite,
            install: values["no-install"] ? false : undefined,
            packageManager: manager,
            siteUrl: values["site-url"],
            locales: values.locales ?? values.locale,
            timeZone: values["time-zone"],
            storage: values.storage,
            extras: values.extras,
            blocks: values.blocks,
            adminPath: values["admin-path"],
            login: values.login,
            directiveSyntax: values["no-directive-syntax"] ? false : values["directive-syntax"],
            log: values.json ? undefined : context.log,
            host: context.initHost,
        });
        if (values.json) {
            context.log(JSON.stringify(report, null, 2));
        }
        else {
            context.log(formatInitReport(report));
            prompter?.outro(report.ok ? "Done." : "Done, with a problem (see above).");
        }
        return report.ok ? 0 : 1;
    },
});
