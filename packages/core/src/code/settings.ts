import type { Message } from "../operation";

/**
 * A line effect a site offers (doc 17, the old `codeBlock.lineEffects`). `class` is what the site puts on the line; the editor draws it with `tone` (the
 * line's ground) and `marker` (one character in the line-number column), never with the site's classes: the admin uses its own colours only.
 */
export type CodeLineEffectDefinition = {
	/** The stored name: lower case, digits and dashes. */
	name: string;
	label: string | Message;
	/** An admin icon name; the default icon when the admin does not know it. */
	icon?: string;
	/** The class the site's line gets. The core's effects have `data-effect` only. */
	class?: string;
	editor?: { tone?: "neutral" | "success" | "danger" | "warning"; marker?: string; wavy?: boolean };
};

export type CodeTools = { rules?: boolean; fold?: boolean; tooltip?: boolean; textStyles?: boolean; links?: boolean };

/** A site's code block settings: `codeBlock` in `monti.config.ts` (doc 17). */
export type CodeBlockConfig = {
	/** Shiki theme names: the site and the editor colour code with the same pair. */
	themes?: { light: string; dark: string };
	/** Shiki language names: the editor's whole list. The old code block's list when left out. */
	languages?: string[];
	/** Tools the editor offers; all on unless `false`. A body that already uses one still reads, renders and saves. */
	tools?: CodeTools;
	/** Line effects the editor does not offer. */
	omitLineEffects?: string[];
	/** Line effects added to the core's; the same name replaces the core's. */
	lineEffects?: CodeLineEffectDefinition[];
};

/** The settings as the admin and the site read them: every value filled in. */
export type CodeBlockSettings = {
	themes: { light: string; dark: string };
	languages: string[];
	tools: Required<CodeTools>;
	/** Every line effect a body may hold, in menu order; `offered` is false for one the editor does not offer. */
	lineEffects: (CodeLineEffectDefinition & { offered: boolean })[];
};

/** The old code block's default languages (`main`'s `default-code-options.ts`). */
export const DEFAULT_CODE_LANGUAGES = [
	"ts",
	"tsx",
	"js",
	"jsx",
	"json",
	"bash",
	"html",
	"css",
	"scss",
	"python",
	"java",
	"kotlin",
	"go",
	"rust",
	"cpp",
	"csharp",
	"swift",
	"sql",
	"yaml",
	"toml",
	"graphql",
	"mdx",
	"vue",
	"svelte",
	"docker",
	"diff",
];

export const DEFAULT_CODE_THEMES = { light: "github-light", dark: "github-dark" };

const effect = (name: string, editor: CodeLineEffectDefinition["editor"], icon: string): CodeLineEffectDefinition => ({
	name,
	label: { key: `code.effect.${name}` },
	icon,
	editor,
});

/** The core's line effects, in menu order (the old code block's defaults). */
export const CORE_LINE_EFFECTS: CodeLineEffectDefinition[] = [
	effect("highlight", { tone: "neutral" }, "Highlight"),
	effect("focus", { marker: "›" }, "CenterToFit"),
	effect("plus", { tone: "success", marker: "+" }, "Add"),
	effect("minus", { tone: "danger", marker: "−" }, "Subtract"),
	effect("warning", { wavy: true, tone: "warning" }, "WarningAlt"),
	effect("error", { wavy: true, tone: "danger" }, "ErrorOutline"),
];

export function codeBlockSettings(config: CodeBlockConfig = {}): CodeBlockSettings {
	const added = config.lineEffects ?? [];
	for (const each of added)
		if (!/^[a-z][a-z0-9-]*$/.test(each.name) || each.name === "collapse" || each.name === "anchor")
			throw new Error(`Code line effect "${each.name}" needs a name of lower-case letters, digits and dashes.`);
	const merged = [
		...CORE_LINE_EFFECTS.map((core) => added.find((each) => each.name === core.name) ?? core),
		...added.filter((each) => !CORE_LINE_EFFECTS.some((core) => core.name === each.name)),
	];
	const omitted = new Set(config.omitLineEffects ?? []);
	const tools = config.tools ?? {};
	return {
		themes: config.themes ?? DEFAULT_CODE_THEMES,
		languages: [...new Set(config.languages ?? DEFAULT_CODE_LANGUAGES)],
		tools: {
			rules: tools.rules !== false,
			fold: tools.fold !== false,
			tooltip: tools.tooltip !== false,
			textStyles: tools.textStyles !== false,
			links: tools.links !== false,
		},
		lineEffects: merged.map((each) => ({ ...each, offered: !omitted.has(each.name) })),
	};
}
