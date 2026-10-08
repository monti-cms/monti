import type { CmsServerPlugin } from "@monti-cms/core";
import { contentHealthChecks } from "./checks";

/** The server side of the plugin: what `monti doctor` runs for it. It could hold `routes`, `hooks`, `commands` and `migrate` as well. */
const server: CmsServerPlugin = { checks: contentHealthChecks };

export default server;
