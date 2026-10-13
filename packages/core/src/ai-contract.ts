/**
 * The contract between the AI plugin (`@monti-cms/ai`) and the plugins that add AI actions (`contributes: { ai: { actions } }`): the block extension's diagram
 * actions, the SEO extension's suggestions, a site's own. Types only: this module has no runtime code, so a plugin that contributes actions imports the shape from
 * here and never depends on the AI plugin, and the published type declarations of a contributing plugin do not point at it. The AI plugin implements the contract
 * (it re-exports these types, and checks its own schemas against them).
 */

import type { BlockDefinition, CollectionsConfig } from "./index";
import type { Site } from "./site";

/** The UI slots an action attaches to. */
export type AiSlot = "field" | "image" | "codeRules" | "media" | "translation" | "selection" | "insert" | "block";

/** In `generate` a chat model answers with text; in `decide` a decision model rates each given choice. */
export type AiEngine = "generate" | "decide";

/** In decide mode, pick only one (`one`), or judge each choice separately and pick several (`many`). */
export type AiPick = "one" | "many";

/** Result shape: several candidates to click, one long text, one body fragment (MDX), or a display-only note. */
export type AiResult = "candidates" | "text" | "mdx" | "note";

/** How the result is applied. `append` adds to a list value (tags, regex rules). */
export type AiApply = "replace" | "append" | "none";

/**
 * Input kinds. `text`, `mdx` and `code` are text, `value` is a field's current value (text or list), `image` is an image the server reads
 * (a media ID or a path on this site), and `locale` is a language code.
 */
export type AiInputKind = "text" | "mdx" | "code" | "value" | "image" | "locale";

export interface AiInputSpec<K extends AiInputKind = AiInputKind> {
	readonly kind: K;
	/** Name used in the admin UI's `Send` list and in the language line attached to the prompt. */
	readonly label: string;
	/** If missing, the action does not run. Without this flag the input may be empty (when empty, it is not sent). */
	readonly required?: boolean;
}

export type AiInputs = Readonly<Record<string, AiInputSpec>>;

/** A fixed result check, as written in an action definition (`enabled` defaults to true). */
export type AiCheckInput =
	| { readonly kind: "pattern"; readonly enabled?: boolean; readonly pattern: string }
	| { readonly kind: "maxLength"; readonly enabled?: boolean; readonly max: number }
	| { readonly kind: "exists"; readonly enabled?: boolean }
	| { readonly kind: "oneOf"; readonly enabled?: boolean; readonly items: string[] }
	| { readonly kind: "code"; readonly enabled?: boolean; readonly name: string };

export type AiAttach =
	/** Beside a field. Without `collections`, every collection that has the field. */
	| { readonly slot: "field"; readonly field: string; readonly collections?: readonly string[] }
	| { readonly slot: "image"; readonly target: "alt" | "caption" }
	| { readonly slot: "media"; readonly target: "filename" | "defaultAlt" | "defaultCaption" }
	| { readonly slot: "codeRules"; readonly target: "fold" }
	/** Block translation in the translation editor (block menu, `Translate all`). */
	| { readonly slot: "translation" }
	/** Menu on the body selection. The result (MDX) shows what changed, then replaces the selected text. */
	| { readonly slot: "selection" }
	/** Slash menu / empty document. The result (MDX) is inserted at the cursor. */
	| { readonly slot: "insert" }
	/** Beside the handle of one body block (`block` is the block name, e.g. `mermaid`). The result (MDX) shows what changed, then replaces that block. */
	| { readonly slot: "block"; readonly block: string };

/**
 * The choices for the decide mode, also used for the `exists` check and candidate names.
 * - `collection`: the published entries of that collection (value is the entry ID, name is the title)
 * - `select`: the options of a select field
 * - `list`: a hand-written list
 */
export type AiChoices =
	| { readonly from: "collection"; readonly collection: string }
	| { readonly from: "select"; readonly collection: string; readonly field: string }
	| { readonly from: "list"; readonly items: readonly string[] };

/** Lookup of core content that code checks read on the server. */
export interface AiContentLookup {
	/** Slugs already used in the same collection and locale. Slugs used by the `excludeEntryId` entry are excluded. */
	slugsInUse(params: {
		readonly collection: string;
		readonly locale: string;
		readonly slugs: readonly string[];
		readonly excludeEntryId?: string;
	}): Promise<ReadonlySet<string>>;
}

/** The situation a code check receives. */
export interface AiValidatorContext {
	/** The inputs used for the run. */
	readonly input: Readonly<Record<string, unknown>>;
	readonly collection?: string;
	/** Content locale. If not in the request, the site config's default locale. */
	readonly locale: string;
	readonly entryId?: string;
	/** For actions with choices: value -> display name. */
	readonly choices?: ReadonlyMap<string, string>;
	/** Core content lookup (server). */
	readonly content: AiContentLookup;
	/** The site the action runs for (its admin language for a note a check attaches to a candidate). */
	readonly site: Site;
}

/**
 * Result of a code check. `true`, `null` or `undefined` passes, `false` discards, and a string discards with that reason.
 * To pass while attaching a note beside the candidate, return `{ detail }`.
 */
export type AiValidatorResult = boolean | string | null | undefined | { readonly detail: string };

/** Code check: checks what the fixed checks (format, length, choices) cannot, using a function. Called on the server once per value. */
export interface AiValidator {
	readonly kind: "code";
	/** Name unique within the action (lowercase, digits, hyphen). The edited value (enabled state) is stored under this name. */
	readonly name: string;
	/** Name shown in the admin UI. A function receives the site and returns the text in its admin language. */
	readonly label: string | ((site: Pick<Site, "createTranslator">) => string);
	/** Enabled initially? Defaults to enabled. */
	readonly enabled?: boolean;
	readonly run: (value: string, context: AiValidatorContext) => AiValidatorResult | Promise<AiValidatorResult>;
}

/** One AI action: what it reads, how it asks, what it answers, where it attaches. */
export interface AiActionDefinition<I extends AiInputs = AiInputs> {
	/** Name shown in the admin UI and on buttons. */
	readonly label: string;
	readonly input: I;
	/** Inputs sent initially. Defaults to all. Toggled in the admin UI. */
	readonly send?: readonly (keyof I & string)[];
	/** Prompt. In decide mode it is the decision criterion. `{{language input name}}` is replaced with the language name. */
	readonly prompt: string;
	readonly result: AiResult;
	/** How the result is applied. Defaults to `none` for notes and `replace` otherwise. */
	readonly apply?: AiApply;
	/** Defaults to `generate`. `decide` requires `choices`. */
	readonly engine?: AiEngine;
	readonly choices?: AiChoices;
	/** In decide mode, pick only one? Defaults to `many`. */
	readonly pick?: AiPick;
	/** Threshold probability for decide mode (0-1). Defaults to 0.6. */
	readonly threshold?: number;
	/** Maximum number of candidates in decide mode. Defaults to 5. */
	readonly maxCount?: number;
	/** Result checks. Fixed checks are applied first, then code checks, in the listed order. */
	readonly checks?: readonly (Exclude<AiCheckInput, { kind: "code" }> | AiValidator)[];
	/** Accepts an extra request at run time. If missing, none is accepted. */
	readonly askInstruction?: boolean;
	/** On click, inserts the result directly without showing it (the candidate is the first one). */
	readonly instant?: boolean;
	/** Streams the result (shown incrementally). Only for text/MDX results in generate mode. */
	readonly stream?: boolean;
	/** Enabled initially? Defaults to enabled. */
	readonly enabled?: boolean;
	readonly attach?: readonly AiAttach[];
	/** Text the dev-only fake connection (`CMS_AI_FAKE=1`) uses as this action's answer, built from the received inputs (name -> text). */
	readonly fake?: (input: Readonly<Record<string, string>>) => string;
}

/** Site config seen by the function that creates actions. */
export interface AiSiteView {
	readonly collections: CollectionsConfig;
	/** Body block definitions used by the site (core + extensions + site). */
	readonly blocks: readonly BlockDefinition[];
	readonly locales: readonly { readonly code: string }[];
	/** Translator of one dictionary in the site's admin language (`site.createTranslator`), for the labels of the actions a function creates. */
	readonly createTranslator: Site["createTranslator"];
	/** Names of the AI config's shared snippets (`aiPlugin({ shared })`). */
	readonly sharedKeys: readonly string[];
}

/**
 * A function that looks at the site config and creates one action. If there is nothing to attach to it returns `undefined` and the action is not enabled.
 * What an action reads from the site is a part of {@link AiSiteView}, so a factory may ask for just that part.
 */
export type AiActionFactory<D extends AiActionDefinition = AiActionDefinition> = (site: AiSiteView) => D | undefined;

/** An action definition or a function that creates one. */
export type AiActionSource = AiActionDefinition | AiActionFactory;

/**
 * The shape in which other plugins add AI actions. Placed in a plugin definition's `contributes: { ai: { actions } }` (unused if there is no AI plugin).
 */
export interface AiContribution {
	readonly actions?: Readonly<Record<string, AiActionSource>>;
}
