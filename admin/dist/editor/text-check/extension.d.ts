import { type TextChecker } from "@monti-cms/core/client";
import type { EditorExtensionContext, EditorExtensionResult } from "../../admin-components.js";
/**
 * Text check (spelling, etc.) UI. When an extension adds a checker to the admin extension point `textCheckers`, each checker gets a toolbar button,
 * and results are shown as wavy underlines, a results panel, and a list. The core has no checkers of its own, and if no checker
 * covers the text's language, it renders nothing.
 */
export declare function useTextCheckEditor(checkers: readonly TextChecker[], context: EditorExtensionContext): EditorExtensionResult;
