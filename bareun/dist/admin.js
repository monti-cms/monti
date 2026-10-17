import { defineAdminPlugin } from "@monti-cms/admin";
import { bareunComponents } from "./provider.js";
/** Admin UI side of the Bareun checker. Plugs the checker into the editor spell check. */
export default defineAdminPlugin({ components: bareunComponents });
