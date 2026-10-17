import { defineAdminPlugin } from "@monti-cms/admin";
import { colorComponents } from "./provider.js";
/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { colorMarkAttributes, colorMarkExtension } from "./provider.js";
/** Admin UI side of the text color extension. Registers the editor's text color display and tools. */
export default defineAdminPlugin({ components: colorComponents });
