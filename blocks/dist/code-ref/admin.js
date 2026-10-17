import { defineAdminPlugin } from "@monti-cms/admin";
import { codeRefComponents } from "./provider.js";
/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { CODE_REF_MARK, codeRefMarkExtension } from "./provider.js";
/** Admin UI side of the code-ref extension. Registers the editor's code-ref display and bubble. */
export default defineAdminPlugin({ components: codeRefComponents });
