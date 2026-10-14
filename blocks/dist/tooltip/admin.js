import { defineBlockAdmin } from "../shared/define-block-admin.js";
import { TooltipProvider } from "./provider.js";
/** Editor registration (for putting into `marks` of `CmsAdminComponentsProvider` in tests or hand-built views). */
export { OPEN_TOOLTIP_EVENT, TOOLTIP_MARK, TooltipProvider, tooltipMarkExtension } from "./provider.js";
/** Admin UI side of the tooltip extension. Registers the editor's tooltip display and tools. */
export default defineBlockAdmin(TooltipProvider);
