import { perSite, type Site } from "@monti-cms/core/client";
import { type Editor, Extension } from "@tiptap/core";

/** Keyboard shortcuts of the Tiptap text style extensions, by mark. */
const SHORTCUTS: Record<string, string[]> = {
	bold: ["Mod-b", "Mod-B"],
	italic: ["Mod-i", "Mod-I"],
	strike: ["Mod-Shift-s"],
	underline: ["Mod-u", "Mod-U"],
};

/**
 * Whether a text style shortcut must do nothing here: the cursor is in a code block, the site turned `codeBlock.features.textStyles` off,
 * and the style is not on the selection (removing it stays possible).
 */
const blocked = (site: Pick<Site, "CODE_BLOCK_FEATURES">, editor: Editor, mark: string) =>
	!site.CODE_BLOCK_FEATURES.textStyles &&
	!!editor.state.selection.$from.parent.type.spec.code &&
	!editor.isActive(mark);

/**
 * Keeps Mod-B, Mod-I, Mod-U and Mod-Shift-S from adding bold, italic, underline and strikethrough inside code when `codeBlock.features.textStyles` is off.
 * Runs before the text style extensions (higher priority) and swallows only the shortcut that would add the style. Outside code nothing changes.
 */
export const codeTextStyleKeys = perSite((site: Pick<Site, "CODE_BLOCK_FEATURES">) =>
	Extension.create({
		name: "codeTextStyleKeys",
		priority: 1000,
		addKeyboardShortcuts() {
			return Object.fromEntries(
				Object.entries(SHORTCUTS).flatMap(([mark, keys]) =>
					keys.map((key) => [key, () => blocked(site, this.editor, mark)]),
				),
			);
		},
	}),
);
