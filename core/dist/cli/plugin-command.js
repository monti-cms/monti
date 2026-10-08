import { parseArgs } from "node:util";
import { loadApp } from "./app.js";
/** `<plugin>:<command>`, both parts a lowercase name. */
const COMMAND_NAME = /^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/;
/** Whether `name` has the shape of a plugin command (`git-sync:pull`). */
export const isPluginCommandName = (name) => COMMAND_NAME.test(name);
const APP_OPTIONS = {
    "env-file": { type: "string", multiple: true },
    "no-env-file": { type: "boolean" },
    config: { type: "string" },
    help: { type: "boolean" },
};
/**
 * `monti <plugin>:<command> [options]`: loads the app's CMS instance, finds the command in the server side of the named plugin and runs it with the instance.
 * The options of the command are the ones it declares plus the app options (`--env-file`, `--no-env-file`, `--config`). Returns the exit code.
 */
export async function runPluginCommand(run) {
    const log = run.log ?? console.log;
    const error = run.error ?? console.error;
    const [, pluginName, commandName] = COMMAND_NAME.exec(run.command) ?? [];
    if (!pluginName || !commandName)
        throw new Error(`Unknown command: ${run.command}`);
    // The app options come first: loading the app is what tells which options the command has.
    const first = parseArgs({ args: [...run.argv], options: APP_OPTIONS, strict: false, allowPositionals: true });
    const envFiles = first.values["no-env-file"] === true ? [] : first.values["env-file"];
    const config = typeof first.values.config === "string" ? first.values.config : run.config;
    const cms = await loadApp({ cwd: run.cwd, envFiles: envFiles ?? run.envFiles, config, log });
    try {
        const plugins = await cms.plugins();
        const plugin = plugins.find((item) => item.name === pluginName);
        const command = plugin?.commands?.[commandName];
        if (!plugin || !command) {
            const known = plugins.flatMap((item) => Object.keys(item.commands ?? {}).map((name) => `${item.name}:${name}`));
            error(`Unknown command: ${run.command}${known.length > 0 ? `\nPlugin commands of this app: ${known.join(", ")}` : ""}`);
            return 1;
        }
        const declared = Object.fromEntries(Object.entries(command.options ?? {}).map(([name, option]) => [name, { type: option.type }]));
        const { values } = parseArgs({
            args: [...run.argv],
            options: { ...APP_OPTIONS, ...declared },
            strict: true,
        });
        if (values.help) {
            log([
                `monti ${run.command}  ${command.description}`,
                ...Object.entries(command.options ?? {}).map(([name, option]) => `  --${name}${option.type === "string" ? " <value>" : ""}  ${option.description ?? ""}`.trimEnd()),
                "  --env-file <file>, --no-env-file, --config <file>   As for migrate",
            ].join("\n"));
            return 0;
        }
        const given = values;
        const args = Object.fromEntries(Object.keys(command.options ?? {}).map((name) => [name, given[name]]));
        const code = await command.run({ cms, args, log, error });
        return typeof code === "number" ? code : 0;
    }
    finally {
        await cms.close();
    }
}
