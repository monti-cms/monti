import { pluginLog } from "@monti-cms/core/server";
import { GIT_SYNC_PLUGIN_NAME } from "./name";

/** The plugin's log: every line starts with `[git-sync]`. */
export const log = pluginLog(GIT_SYNC_PLUGIN_NAME);
