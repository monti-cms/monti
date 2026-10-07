"use client";

import { useTranslator } from "@monti-cms/core/client";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { TranslatorFor } from "../translator";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { editorMessages } from "./messages";

/**
 * Editor body width. Changes only the width shown while editing; unrelated to the saved content and the public page.
 * The browser remembers only the step name, so the width values can be changed here alone.
 */
export const EDITOR_WIDTHS = {
	/** Comfortable reading width for body text (42rem, same as Tailwind `max-w-2xl`). */
	narrow: "42rem",
	normal: "48rem",
	wide: "64rem",
	full: "none",
} as const;

export type EditorWidth = keyof typeof EDITOR_WIDTHS;

const LABELS = (t: TranslatorFor<typeof editorMessages>): Record<EditorWidth, string> => ({
	narrow: t("editorWidth.narrow"),
	normal: t("editorWidth.normal"),
	wide: t("editorWidth.wide"),
	full: t("editorWidth.full"),
});
const STORAGE_KEY = "cms:editor-width";
const isEditorWidth = (value: unknown): value is EditorWidth =>
	typeof value === "string" && Object.hasOwn(EDITOR_WIDTHS, value);

/** Chosen body width. Remembered in this browser; starts at the normal width if storage is unavailable. */
export function useEditorWidth(): [EditorWidth, (width: EditorWidth) => void] {
	const [width, setWidth] = useState<EditorWidth>("normal");
	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (isEditorWidth(stored)) setWidth(stored);
		} catch {
			// Use the default width if storage is unavailable.
		}
	}, []);
	const change = (next: EditorWidth) => {
		setWidth(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// The width still changes even if it cannot be remembered.
		}
	};
	return [width, change];
}

/** Body width menu at the right end of the toolbar. */
export function EditorWidthMenu({ value, onChange }: { value: EditorWidth; onChange: (width: EditorWidth) => void }) {
	const t = useTranslator(editorMessages);
	return (
		<DropdownMenu>
			<IconButton
				label={t("editorWidth.label")}
				side="bottom"
				className="text-cms-muted-foreground"
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<MoveHorizontal aria-hidden className="size-4" />
			</IconButton>
			<DropdownMenuContent align="end" className="w-36">
				<DropdownMenuRadioGroup
					aria-label={t("editorWidth.label")}
					value={value}
					onValueChange={(next) => isEditorWidth(next) && onChange(next)}
				>
					{(Object.keys(EDITOR_WIDTHS) as EditorWidth[]).map((width) => (
						<DropdownMenuRadioItem key={width} value={width}>
							{LABELS(t)[width]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
