import { defineAdminPlugin } from "@monti-cms/admin";
import { tooltipComponents } from "./provider";

/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { TOOLTIP_FORMAT, TOOLTIP_MARK, tooltipMarkExtension } from "./provider";

/** Admin UI side of the tooltip extension. Registers the editor's tooltip display and tools. */
export default defineAdminPlugin({ components: tooltipComponents });
