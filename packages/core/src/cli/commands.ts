import { adminResetPasswordCommand } from "./admin-command";
import type { Command } from "./command";
import { dbMigrateCommand, dbSetupCommand } from "./db";
import { doctorCommand } from "./doctor";
import { eventsRetryCommand } from "./events";
import { initCommand } from "./init-command";
import { schemaApplyCommand, schemaDiffCommand, schemaExtractCommand } from "./schema-command";

/** Every command of the `monti` command line, in the order the help lists them. (`<plugin>:<command>` is not here: the plugins of the app decide it.) */
export const COMMANDS: readonly Command[] = [
	initCommand,
	dbSetupCommand,
	dbMigrateCommand,
	adminResetPasswordCommand,
	eventsRetryCommand,
	doctorCommand,
	schemaExtractCommand,
	schemaDiffCommand,
	schemaApplyCommand,
];

/** The command with this name, if there is one. */
export const findCommand = (name: string): Command | undefined => COMMANDS.find((command) => command.name === name);
