import { parseArgs } from "node:util";
import { hostOf } from "../cms/host";
import type { PluginCommand } from "../plugin/define";
import { loadApp } from "./app";
import { APP_OPTIONS, appFlagsOf, type CliContext, optionLines } from "./command";

/** `<plugin>:<command>`, both parts a lowercase name. */
const COMMAND_NAME = /^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/;

/** Whether `name` has the shape of a plugin command (`git-sync:pull`). */
export const isPluginCommandName = (name: string): boolean => COMMAND_NAME.test(name);

const PARSE_OPTIONS = {
	"env-file": { type: "string", multiple: true },
	"no-env-file": { type: "boolean" },
	config: { type: "string" },
	help: { type: "boolean" },
} as const;

/**
 * `monti <plugin>:<command> [options]`: loads the app's CMS instance, finds the command in the server side of the named plugin and runs it with the instance.
 * The options of the command are the ones it declares plus the app options (`--env-file`, `--no-env-file`, `--config`). Returns the exit code.
 */
export async function runPluginCommand(
	context: CliContext,
	fullName: string,
	argv: readonly string[],
): Promise<number> {
	const { log, error } = context;
	const [, pluginName, commandName] = COMMAND_NAME.exec(fullName) ?? [];
	if (!pluginName || !commandName) throw new Error(`Unknown command: ${fullName}`);

	// The app options come first: loading the app is what tells which options the command has.
	const first = parseArgs({ args: [...argv], options: PARSE_OPTIONS, strict: false, allowPositionals: true });
	const app = appFlagsOf({
		"env-file": first.values["env-file"] as string[] | undefined,
		"no-env-file": first.values["no-env-file"] === true,
		config: typeof first.values.config === "string" ? first.values.config : undefined,
	});
	const cms = await loadApp({ cwd: context.cwd, log, error, ...app });
	try {
		const plugins = await hostOf(cms).plugins();
		const plugin = plugins.find((item) => item.name === pluginName);
		const command: PluginCommand | undefined = plugin?.commands?.[commandName];
		if (!plugin || !command) {
			const known = plugins.flatMap((item) => Object.keys(item.commands ?? {}).map((name) => `${item.name}:${name}`));
			error(
				`Unknown command: ${fullName}${known.length > 0 ? `\nPlugin commands of this app: ${known.join(", ")}` : ""}`,
			);
			return 1;
		}
		const declared = Object.fromEntries(
			Object.entries(command.options ?? {}).map(([name, option]) => [name, { type: option.type }]),
		);
		const { values } = parseArgs({
			args: [...argv],
			options: { ...PARSE_OPTIONS, ...declared },
			strict: true,
		});
		if (values.help) {
			log(
				[
					`monti ${fullName}  ${command.description}`,
					...Object.entries(command.options ?? {}).map(([name, option]) =>
						`  --${name}${option.type === "string" ? " <value>" : ""}  ${option.description ?? ""}`.trimEnd(),
					),
					...optionLines(APP_OPTIONS),
				].join("\n"),
			);
			return 0;
		}
		const given: Readonly<Record<string, unknown>> = values;
		const args = Object.fromEntries(
			Object.keys(command.options ?? {}).map((name) => [name, given[name] as string | boolean | undefined]),
		);
		const code = await command.run({ cms, plugin: cms.plugin(pluginName), args, log, error });
		return typeof code === "number" ? code : 0;
	} finally {
		await cms.close();
	}
}
