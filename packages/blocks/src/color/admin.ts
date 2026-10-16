import { defineBlockAdmin } from "../shared/define-block-admin";
import { ColorProvider } from "./provider";

/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { ColorProvider, colorMarkAttributes, colorMarkExtension } from "./provider";

/** Admin UI side of the text color extension. Registers the editor's text color display and tools. */
export default defineBlockAdmin(ColorProvider);
