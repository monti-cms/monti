import { parseArgs } from "node:util";
import type { Cms } from "../cms";
import { hostOf } from "../cms/host";
import type { PluginCommand } from "../plugin/define";
import { loadApp } from "./app";
import { APP_OPTIONS, appFlagsOf, type CliContext, optionLines } from "./command";

/** `<plugin>:<command>`, both parts a lowercase name. */
const COMMAND_NAME = /^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/;

/** Whether `name` has the shape of a plugin command (`my-plugin:pull`). */
export const isPluginCommandName = (name: string): boolean => COMMAND_NAME.test(name);

const PARSE_OPTIONS = {
	"env-file": { type: "string", multiple: true },
	"no-env-file": { type: "boolean" },
	config: { type: "string" },
	help: { type: "boolean" },
} as const;

/** The plugin and the command of a name like `my-plugin:pull`. */
function partsOf(fullName: string): { readonly pluginName: string; readonly commandName: string } {
	const [, pluginName, commandName] = COMMAND_NAME.exec(fullName) ?? [];
	if (!pluginName || !commandName) throw new Error(`Unknown command: ${fullName}`);
	return { pluginName, commandName };
}

/**
 * `monti <plugin>:<command> [options]`: loads the app's CMS instance with the app options (`--env-file`, `--no-env-file`, `--config`), then runs the command
 * with it (see {@link runPluginCommandWith}). Returns the exit code.
 */
export async function runPluginCommand(
	context: CliContext,
	fullName: string,
	argv: readonly string[],
): Promise<number> {
	// A name that is not `<plugin>:<command>` fails before the app loads.
	partsOf(fullName);
	// The app options come first: loading the app is what tells which options the command has.
	const first = parseArgs({ args: [...argv], options: PARSE_OPTIONS, strict: false, allowPositionals: true });
	const app = appFlagsOf({
		"env-file": first.values["env-file"] as string[] | undefined,
		"no-env-file": first.values["no-env-file"] === true,
		config: typeof first.values.config === "string" ? first.values.config : undefined,
	});
	const cms = await loadApp({ cwd: context.cwd, log: context.log, error: context.error, ...app });
	return runPluginCommandWith(cms, context, fullName, argv);
}

/**
 * Finds the command in the server side of the named plugin and runs it with `cms`, then closes `cms` (also when the command fails or is unknown).
 * The options of the command are the ones it declares plus the app options, which are accepted and left to {@link runPluginCommand}. Returns the exit code.
 */
export async function runPluginCommandWith(
	cms: Cms,
	context: CliContext,
	fullName: string,
	argv: readonly string[],
): Promise<number> {
	const { log, error } = context;
	try {
		const { pluginName, commandName } = partsOf(fullName);
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
