import { parseArgs } from "node:util";
import { formatDoctorReport } from "./format.js";
import { runDoctor } from "./run.js";
export const DOCTOR_HELP = `  doctor    Check the setup and say how to fix what is wrong: the config file, the schema file, the database and its migrations, the secret, the login, the Next files,
            and upgrade checks (for sites coming from the pre-overhaul setup). Every warning and failure says what is wrong, where, and how to fix it. Exit code 1 when a check fails.
              --json                Print the result as JSON (for tools): { ok, cwd, summary, checks: [{ id, group, title, status, message, where?, fix? }] }
              --only <list>         Run only these checks: groups or ids, comma separated (config, database, database/migrations, auth, ...)
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;
/** `monti doctor [--json] [--only <list>] [--env-file <file>] [--no-env-file] [--config <file>]`. Returns the exit code: 1 when a check fails. */
export async function runDoctorCommand(argv, io) {
    const { values } = parseArgs({
        args: [...argv],
        options: {
            json: { type: "boolean" },
            only: { type: "string" },
            "env-file": { type: "string", multiple: true },
            "no-env-file": { type: "boolean" },
            config: { type: "string" },
            help: { type: "boolean", short: "h" },
        },
    });
    if (values.help) {
        io.log(DOCTOR_HELP);
        return 0;
    }
    const only = values.only
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const report = await runDoctor({
        cwd: io.cwd,
        envFiles: values["no-env-file"] ? [] : values["env-file"],
        config: values.config,
        only,
    });
    io.log(values.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
    return report.ok ? 0 : 1;
}
