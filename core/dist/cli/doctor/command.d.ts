export declare const DOCTOR_HELP = "  doctor    Check the setup and say how to fix what is wrong: the config file, the schema file, the database and its migrations, the secret, the login, the Next files,\n            and upgrade checks (for sites coming from the pre-overhaul setup). Every warning and failure says what is wrong, where, and how to fix it. Exit code 1 when a check fails.\n              --json                Print the result as JSON (for tools): { ok, cwd, summary, checks: [{ id, group, title, status, message, where?, fix? }] }\n              --only <list>         Run only these checks: groups or ids, comma separated (config, database, database/migrations, auth, ...)\n              --env-file <file>, --no-env-file, --config <file>   As for migrate\n";
/** The parts of the CLI I/O `monti doctor` uses. */
export interface DoctorCommandIo {
    readonly cwd: string;
    readonly log: (message: string) => void;
    readonly error: (message: string) => void;
}
/** `monti doctor [--json] [--only <list>] [--env-file <file>] [--no-env-file] [--config <file>]`. Returns the exit code: 1 when a check fails. */
export declare function runDoctorCommand(argv: readonly string[], io: DoctorCommandIo): Promise<number>;
