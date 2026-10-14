import { adminResetPasswordCommand } from "./admin-command.js";
import { dbMigrateCommand, dbSetupCommand } from "./db.js";
import { doctorCommand } from "./doctor/index.js";
import { eventsRetryCommand } from "./events.js";
import { initCommand } from "./init-command.js";
import { schemaApplyCommand, schemaDiffCommand, schemaExtractCommand } from "./schema-command.js";
/** Every command of the `monti` command line, in the order the help lists them. (`<plugin>:<command>` is not here: the plugins of the app decide it.) */
export const COMMANDS = [
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
export const findCommand = (name) => COMMANDS.find((command) => command.name === name);
