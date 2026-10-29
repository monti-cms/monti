"use client";

import type { EditorWidthStep as EditorWidthStepConfig } from "@monti-cms/core";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuValue,
} from "@monti-cms/ui";
import { useMemo } from "react";
import { stringCodec, usePreference } from "../lib/hooks/use-preference";
import type { TranslatorFor } from "../translator";
import { editorMessages } from "./messages";

/** One width step of the editor: `key` is what the browser remembers, `width` the CSS value of the body's `max-width`. */
export interface EditorWidthStep {
	readonly key: string;
	readonly label: string;
	readonly width: string;
}

/** The width of the single built-in step ("Normal") used when the config sets no `editor.widths`. */
export const DEFAULT_EDITOR_WIDTH = "48rem";
/** The `max-width` of the last step, "Full": no limit. */
export const FULL_EDITOR_WIDTH = "none";

/** Key of the built-in steps. The step of the config is remembered by its label (`label:Desktop`), so a changed config still finds it. */
const NORMAL_KEY = "normal";
const FULL_KEY = "full";

/**
 * The steps of the width menu, in order: the config's `editor.widths` (or "Normal" when it sets none), then "Full". The first is where the editor starts.
 * Changes only the width shown while editing; unrelated to the saved content and the public page.
 */
export function resolveEditorWidths(
	configured: readonly EditorWidthStepConfig[] | undefined,
	t: TranslatorFor<typeof editorMessages>,
): EditorWidthStep[] {
	const steps: EditorWidthStep[] = configured?.length
		? configured.map(({ label, width }) => ({ key: `label:${label}`, label, width }))
		: [{ key: NORMAL_KEY, label: t("editorWidth.normal"), width: DEFAULT_EDITOR_WIDTH }];
	return [...steps, { key: FULL_KEY, label: t("editorWidth.full"), width: FULL_EDITOR_WIDTH }];
}

/** Name of the remembered width in the site's browser preferences (per device, see `usePreference`). */
const STORAGE_NAME = "editor-width";

/**
 * The steps of this site and the chosen one. The choice is remembered in this browser, per site, by step key; a remembered key that no step has any more
 * (the config changed) and unavailable storage both leave the first step.
 */
export function useEditorWidth(): { steps: EditorWidthStep[]; step: EditorWidthStep; choose: (key: string) => void } {
	const site = useSite();
	const t = useTranslator(editorMessages);
	const configured = site.config.editor?.widths;
	const steps = useMemo(() => resolveEditorWidths(configured, t), [configured, t]);
	const [key, choose] = usePreference(STORAGE_NAME, stringCodec, "");
	const step = steps.find((candidate) => candidate.key === key) ?? (steps[0] as EditorWidthStep);
	return { steps, step, choose };
}

/**
 * "Body width ▸" in the editor's ⋯ menu: the row shows the chosen step, and its second level picks another. Every editor on the page reads the same
 * remembered step, so the menu and the body stay in step without passing it around.
 */
export function EditorWidthSubmenu() {
	const t = useTranslator(editorMessages);
	const { steps, step, choose } = useEditorWidth();
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				{t("editorWidth.label")}
				<MenuValue>{step.label}</MenuValue>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				<DropdownMenuRadioGroup
					aria-label={t("editorWidth.label")}
					value={step.key}
					onValueChange={(next) => typeof next === "string" && choose(next)}
				>
					{steps.map((item) => (
						<DropdownMenuRadioItem key={item.key} value={item.key}>
							{item.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
