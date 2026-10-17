import { defineAdminPlugin } from "@monti-cms/admin";
import { tooltipComponents } from "./provider.js";
/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { OPEN_TOOLTIP_EVENT, TOOLTIP_MARK, tooltipMarkExtension } from "./provider.js";
/** Admin UI side of the tooltip extension. Registers the editor's tooltip display and tools. */
export default defineAdminPlugin({ components: tooltipComponents });
