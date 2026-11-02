import { type MessageBundle, translate } from "@monti-cms/core";
import type { AiSlot } from "@monti-cms/core/ai-contract";
import type { Translator } from "@monti-cms/core/site";
import { z } from "zod";
import { coreMessages } from "./core.messages";

/** Translator of the validation messages (`coreMessages`) the schemas report. */
export type CoreText = Translator<typeof coreMessages extends MessageBundle<infer K> ? K : never>;

/** The validation messages in English, for checks of developer-written definitions (config errors, not shown to the operator). */
export const englishCoreText: CoreText = (key, vars) => translate(coreMessages, "en", key, vars);

/**
 * AI common definitions. The choices and result shapes shared by the action definition (`action.ts`), the runner and the admin UI.
 * Used by both server and browser, so no secrets or SDKs go here.
 */

/**
 * The UI slots an action attaches to. Each slot provides fixed material (`SLOT_INPUTS`).
 * `translation` is block translation in the translation editor (block menu and `Translate all`), `selection` is the menu shown when selecting text in the body
 * (e.g. style polish, replaces the selected text), and `insert` is the slash (`/`) menu and the empty document (e.g. draft writing, inserts at the cursor).
 * `block` is a button beside the handle of one body block (e.g. a Mermaid diagram). It sends the block source and replaces the block with the changed one.
 */
export type { AiSlot } from "@monti-cms/core/ai-contract";

/**
 * The slots that have a place to type an extra request (`askInstruction`): the translation editor, the selection menu, the slash menu and a block's handle. A field,
 * an image, the media screen and code rules run at one press with nothing to type, so an action attached only there never asks.
 */
export const AI_ASKING_SLOTS: readonly AiSlot[] = ["translation", "selection", "insert", "block"];
/** Whether an action attached to these slots can ask for an extra request. */
export const slotsAsk = (attach: readonly { readonly slot: AiSlot }[]): boolean =>
	attach.some((item) => AI_ASKING_SLOTS.includes(item.slot));

/**
 * Mode. In `generate`, a chat model (LLM) answers with text. In `decide`, a decision model (System One, e.g. Jev)
 * rates the probability that each given choice fits, and only choices above the threshold become candidates. The decision model does not write text.
 */
/**
 * In decide mode, pick only one (`one`), or judge each choice separately and pick several (`many`).
 */
/**
 * Result shape. `candidates` is several candidates to click, `text` is one long text, `mdx` is one body fragment (MDX),
 * `note` is a display-only note.
 */
/**
 * How the result is applied. `append` adds to a list value (tags, regex rules).
 */
export type { AiApply, AiEngine, AiPick, AiResult } from "@monti-cms/core/ai-contract";

/** Code check name (lowercase, digits, hyphen). */
export const CODE_CHECK_NAME = /^[a-z][a-z0-9-]*$/;

const patternSchemaOf = (t: CoreText) =>
	z
		.string()
		.trim()
		.min(1)
		.max(500)
		.refine(
			(pattern) => {
				try {
					new RegExp(pattern, "u");
					return true;
				} catch {
					return false;
				}
			},
			{ error: () => t("check.invalidRegex") },
		);

const enabled = z.boolean().default(true);

/**
 * Result checks. Set per action as a list; candidates that do not pass are discarded.
 * Fixed checks include only those usable by any action.
 * - `pattern`: only values matching the regex
 * - `maxLength`: only values not over the maximum length
 * - `exists`: only values that actually exist in the choices (`choices`)
 * - `oneOf`: only values that are one of a given list (`items`)
 *
 * Checks that differ per action (slug duplicates, regex execution, translation structure, etc.) are built as code checks (`defineValidator`) and put in the action's `checks`.
 */
const aiCheckSchemaOf = (t: CoreText) =>
	z.discriminatedUnion("kind", [
		z.object({ kind: z.literal("pattern"), enabled, pattern: patternSchemaOf(t) }),
		z.object({ kind: z.literal("maxLength"), enabled, max: z.number().int().min(1).max(5000) }),
		z.object({ kind: z.literal("exists"), enabled }),
		z.object({ kind: z.literal("oneOf"), enabled, items: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }),
		z.object({ kind: z.literal("code"), enabled, name: z.string().max(60).regex(CODE_CHECK_NAME) }),
	]);

/** The check schema with English messages: reads definitions, where no message is shown. */
export const aiCheckSchema = aiCheckSchemaOf(englishCoreText);
export type AiCheck = z.output<typeof aiCheckSchema>;
export type AiCheckInput = z.input<typeof aiCheckSchema>;

/** Number of choices that can be asked of the decision model at once. */
export const MAX_DECISION_OPTIONS = 255;

export const MAX_REQUEST_LENGTH = 1000;

/** One candidate shown as a result in a slot. `value` is the value to apply and `label` is the displayed text. */
export interface AiCandidate {
	value: string;
	label: string;
	/** Short note to append (e.g. the number of places a regex found). */
	detail?: string;
}

export type AiRunResult =
	| { kind: "candidates"; items: AiCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/**
 * The current situation a UI slot passes on click. Each slot fills only the values it knows. Passed on as the action's input (`action.input`).
 * The tag list and images are read directly by the server (the list and addresses sent by the browser are not trusted).
 */
export interface AiRunContext {
	/** Extra request entered at run time. Appended to the prompt only if the action has `askInstruction`. */
	request?: string;
	collection?: string;
	locale?: string;
	entryId?: string;
	title?: string;
	summary?: string;
	body?: string;
	/** The target's current value. List values (tag ids, etc.) are arrays. */
	current?: string | readonly string[];
	around?: string;
	/** Text (MDX) selected in the selection menu. */
	selection?: string;
	code?: string;
	language?: string;
	mediaId?: string;
	/** Site path (`/images/...`) of an image outside the media library. The server reads it from its own site. */
	imageSrc?: string;
	filename?: string;
}
