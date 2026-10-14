import { defineCommand } from "../command.js";
import { formatDoctorReport } from "./format.js";
import { runDoctor } from "./run.js";
/** `monti doctor [--json] [--only <list>] [env options]`. Exits 1 when a check fails. */
export const doctorCommand = defineCommand({
    name: "doctor",
    summary: `Check the setup and say how to fix what is wrong: the config file, the schema file, the database and its migrations, the secret, the login, the Next files.
Every warning and failure says what is wrong, where, and how to fix it. Exit code 1 when a check fails.`,
    options: {
        json: {
            type: "boolean",
            help: "Print the result as JSON (for tools): { ok, cwd, summary, checks: [{ id, group, title, status, message, where?, fix? }] }",
        },
        only: {
            type: "string",
            value: "<list>",
            help: "Run only these checks: groups or ids, comma separated (config, database, database/migrations, auth, ...)",
        },
    },
    app: true,
    run: async (context) => {
        const only = context.values.only
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        const report = await runDoctor({ cwd: context.cwd, ...context.app, only });
        context.log(context.values.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
        return report.ok ? 0 : 1;
    },
});
