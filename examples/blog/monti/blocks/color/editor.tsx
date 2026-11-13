"use client";

import type { AdminMarkEditorProps } from "@monti-cms/admin";
import { IconButton, Inline, Label, Stack, useBlockLanguage } from "@monti-cms/admin/blocks";
import { Checkmark } from "@monti-cms/admin/icons";
import { COLORS } from "./site";
import { words } from "./words";

/**
 * The colour card (doc 18, the old block's): a row for the text colour and a row for the background, each the default and the eight colours as the
 * letter in that colour, the current one with a ✓, its name on hover. A press puts it on the picked words and closes the card.
 */
export default function ColorEditor({ attrs, apply }: AdminMarkEditorProps) {
	const language = useBlockLanguage();
	const say = (label: { ko: string; en: string }) => label[language];
	const set = (key: "color" | "background", value: string | undefined) => {
		const next = { color: attrs?.color, background: attrs?.background, [key]: value };
		const kept = Object.fromEntries(Object.entries(next).filter(([, each]) => typeof each === "string"));
		apply(Object.keys(kept).length > 0 ? kept : null);
	};
	const row = (key: "color" | "background") => {
		const current = typeof attrs?.[key] === "string" ? attrs[key] : undefined;
		return (
			<Stack gap={4}>
				<Label>{say(key === "color" ? words.text : words.background)}</Label>
				<Inline gap={2} wrap>
					{[undefined, ...COLORS].map((name) => (
						<IconButton
							key={name ?? "none"}
							size="sm"
							label={name ? say(words.names[name]) : say(words.none)}
							pressed={current === name}
							onClick={() => set(key, name)}
						>
							<span
								className="monti-color"
								data-color={key === "color" ? name : undefined}
								data-background={key === "background" ? name : undefined}
							>
								{current === name ? <Checkmark aria-hidden /> : say(words.sample)}
							</span>
						</IconButton>
					))}
				</Inline>
			</Stack>
		);
	};
	return (
		<Stack gap={12}>
			{row("color")}
			{row("background")}
		</Stack>
	);
}
