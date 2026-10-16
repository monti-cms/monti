import { defineBlockAdmin } from "../shared/define-block-admin";
import { CodeRefProvider } from "./provider";

/** Editor registration (for putting into `marks` of `AdminComponentsProvider` in tests or hand-built views). */
export { CODE_REF_MARK, CodeRefProvider, codeRefMarkExtension } from "./provider";

/** Admin UI side of the code-ref extension. Registers the editor's code-ref display and bubble. */
export default defineBlockAdmin(CodeRefProvider);
