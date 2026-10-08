import { DOCTOR_HELP } from "./doctor/command";
import { IMPORT_HELP } from "./import/command";

/**
 * The help texts of the `monti` command line. Each command has its own section, so `monti <command> --help` prints only that command's, and `monti --help`
 * prints the header and every section. A section is a two-space indented block that starts with the command name, the way `IMPORT_HELP` and `DOCTOR_HELP` are.
 */

const INIT_HELP = `  init      Add Monti to an existing Next app (App Router): asks a few questions, writes explicit files and installs the packages; run monti migrate next.
            Existing files are never overwritten without a yes. Every question has a flag; with --yes, --json, or no terminal nothing is asked.
              --yes, -y             Take the default for every question that has no flag
              --json                Print the result as JSON (implies --yes)
              --dry-run             Show what would be written and run, and change nothing
              --database <v>        A postgres:// URL, or "skip" to fill DATABASE_URL in later (default skip)
              --database-schema <n> Postgres schema for the tables (DATABASE_SCHEMA in .env.local), for a database shared with other apps (default public)
              --admin-github-id <n> Numeric GitHub id of the admin (MONTI_ADMIN_GITHUB_ID in .env.local)
              --site-url <url>      Public site URL, for the GitHub OAuth callback URL (default http://localhost:3000)
              --locales <list>      Language codes, the default first (default: the languages found in file names like hello.ko.mdx or in folders like ko/, else en);
                                    --locale <code> is the same for one
              --time-zone <tz>      IANA time zone for dates and times (default UTC)
              --storage <s3|none>   Image storage: an S3-compatible store (S3, R2, MinIO), or none for now (default none)
              --extras <list>       ai, git-sync, or none (default none)
              --blocks <list>       default, all, none, or block names: callout, collapsible, tabs, columns, code-explorer, mermaid, chart, tooltip, code-ref, color
                                    (default: the light set, callout, collapsible, tabs, code-ref and color. mermaid adds about 26 MB of packages and chart adds
                                    recharts, so both are opt-in: name them, or pass all)
              --admin-path <path>   Admin screen path (default /studio)
              --overwrite           Replace existing files that differ (default: keep them)
              --no-install          Do not install packages
              --package-manager <m> npm, pnpm, yarn or bun (default: detected)
`;

const ADD_HELP = `  add       Copy components from the registry into the app as source you own, and install their npm packages
              <name...>             Components to add; the ones they need come along
              --registry <url|path> Registry folder or URL with registry.json (default: the registry shipped inside the installed @monti-cms/core, so the
                                    components match the packages the app has)
              --overwrite           Replace files that differ from the registry (default: stop and write nothing)
              --dry-run             Show what would be written and installed
              --yes, -y             Also add the typography plugin and the render.css imports the component needs to your global CSS without asking (default: ask, or print the lines)
`;

const MIGRATE_HELP = `  migrate   Create or update the tables in the database of monti.config.ts, and say where (host, database, schema) and how many steps ran
              --env-file <file>     Env file to read (repeatable, default .env.local and .env)
              --no-env-file         Don't read any env file
              --config <file>       The config file that exports the CMS instance (default: ./monti.config.ts, ./src/monti.config.ts)
`;

const EVENTS_RETRY_HELP = `  events:retry    Deliver the afterCommit events that are due: retries of failed deliveries, and events a stopped process never delivered (run it from a cron job)
              --all                 Also try the failed deliveries that are not due yet
              --limit <n>           Most deliveries to try (default 100)
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

const PLUGIN_HELP = `  <plugin>:<command>    Run a command a plugin adds, with the app loaded as for migrate (for example git-sync:pull). Add --help for its options
`;

const SCHEMA_TYPES_HELP = `  schema:types    Write the types of the schema file (monti-env.d.ts), so collections and locales are typed without writing types
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --out <file>          Declaration file (default: monti-env.d.ts next to the schema file)
              --watch               Keep running and rewrite the types when the schema file changes
              --check               Write nothing; exit 1 if the declaration file is out of date
`;

const SCHEMA_EXTRACT_HELP = `  schema:extract  Write the data part of the config file to monti.schema.json and list what stays in code
              --config <file>       Config file (default: ./monti.config.ts, then ./cms.config.ts; each also under ./src)
              --out <file>          Schema file to write (default: monti.schema.json next to the config file)
              --overwrite           Replace the schema file if it exists
              --locale <code>       Language for labels plugins provide (default: the admin language)
              --no-types            Do not write the declaration file
`;

const SCHEMA_DIFF_HELP = `  schema:diff     Compare the schema with the one last applied to the database and list the stored entries each change touches (read-only)
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --check               Exit 1 when there is anything to apply
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

const SCHEMA_APPLY_HELP = `  schema:apply    Run the data transforms of the schema file (migrations) once each, record the schema, and raise schemaVersion in the file when the schema changed
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --dry-run             Run everything in a transaction that is rolled back, and write nothing
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

/** Commands that have a section of their own, in the order `monti --help` lists them. */
const SECTIONS: readonly (readonly [string, string])[] = [
	["init", INIT_HELP],
	["add", ADD_HELP],
	["import", IMPORT_HELP],
	["migrate", MIGRATE_HELP],
	["events:retry", EVENTS_RETRY_HELP],
	["<plugin>", PLUGIN_HELP],
	["doctor", DOCTOR_HELP],
	["schema:types", SCHEMA_TYPES_HELP],
	["schema:extract", SCHEMA_EXTRACT_HELP],
	["schema:diff", SCHEMA_DIFF_HELP],
	["schema:apply", SCHEMA_APPLY_HELP],
];

const HEADER = `Usage: monti <command> [options]

Install first: \`monti\` is the command of the package @monti-cms/core, so add that package to your app, then run the command through your package manager
(pnpm exec monti init, npx monti init, yarn monti init or bunx monti init). Running \`npx monti\` before the install fetches a different package called "monti".
\`monti <command> --help\` shows the options of one command.

Commands:
`;

/** The help of the whole command line. */
export const HELP = `${HEADER}${SECTIONS.map(([, text]) => text).join("")}`;

/** The help of one command: its section, under a usage line. `undefined` for a name that is not a command with a section (a plugin command prints its own). */
export function helpFor(command: string): string | undefined {
	const section = SECTIONS.find(([name]) => name === command)?.[1];
	return section === undefined ? undefined : `Usage: monti ${command} [options]\n\n${section}`;
}
