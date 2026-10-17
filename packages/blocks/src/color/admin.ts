import { defineAdminPlugin } from "@monti-cms/admin";
import { colorComponents } from "./provider";

/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { colorMarkAttributes, colorMarkExtension } from "./provider";

/** Admin UI side of the text color extension. Registers the editor's text color display and tools. */
export default defineAdminPlugin({ components: colorComponents });
