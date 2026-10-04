import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ColorProvider } from "./provider.js";
/** Editor registration (for putting into `marks` of `CmsAdminComponentsProvider` in tests or hand-built views). */
export { ColorProvider, colorMarkAttributes, colorMarkExtension } from "./provider.js";
/** Admin UI side of the text color extension. Registers the editor's text color display and tools. */
export default defineAdminPlugin({ Provider: ColorProvider });
