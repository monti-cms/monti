import { defineAdminPlugin } from "@monti-cms/admin";
import { BareunProvider } from "./provider";

/** Admin UI side of the Bareun checker. Plugs the checker into the editor spell check. */
export default defineAdminPlugin({ Provider: BareunProvider });
