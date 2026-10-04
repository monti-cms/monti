import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { TooltipProvider } from "./provider";

/** Editor registration (for putting into `marks` of `CmsAdminComponentsProvider` in tests or hand-built views). */
export { OPEN_TOOLTIP_EVENT, TOOLTIP_MARK, TooltipProvider, tooltipMarkExtension } from "./provider";

/** Admin UI side of the tooltip extension. Registers the editor's tooltip display and tools. */
export default defineAdminPlugin({ Provider: TooltipProvider });
