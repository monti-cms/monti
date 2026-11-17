"use client";

import { BlockBar, BlockBarMenu, BlockContent, BlockFrame, BlockTitle, useBlock } from "@monti-cms/admin/blocks";
import { Idea, Information, Pen, Warning, WarningAlt } from "@monti-cms/admin/icons";
import { KIND_ICONS } from "./kind-icons";
import { TONES, type Tone, toneOf } from "./site";
import { style } from "./style";
import { words, wordsIn } from "./words";

/** The glyphs by their Carbon names; each kind takes its own by the map of `kind-icons.ts`, which the title icon of `style.ts` is made from too. */
const GLYPHS = { Pen, Idea, Information, Warning, WarningAlt };
const ICONS = Object.fromEntries(TONES.map((tone) => [tone, GLYPHS[KIND_ICONS[tone]]])) as Record<Tone, typeof Pen>;

/**
 * The callout in the editor (doc 18): the site's box, its title typed in it (its kind's name in grey while empty, Enter and Esc go to its words), and
 * its tool row's kind button, a menu of the five kinds with a ✓ on the current one.
 */
export default function CalloutEditor() {
	const block = useBlock();
	const tone = toneOf(block.attrs.tone);
	const say = (label: { ko: string; en: string }) => label[block.language];
	return (
		<BlockFrame
			bar={
				<BlockBar label={say(words.tools)}>
					<BlockBarMenu
						label={say(words.kind)}
						named
						value={tone}
						options={TONES.map((each) => {
							const Icon = ICONS[each];
							return { value: each, label: say(words.tones[each]), icon: <Icon aria-hidden /> };
						})}
						onChange={(next) => block.setAttrs({ tone: next === "note" ? undefined : next })}
					/>
				</BlockBar>
			}
		>
			<style href="monti-block-callout" precedence="monti-blocks">
				{style}
			</style>
			<div
				className="monti-block-callout"
				data-tone={tone}
				role="note"
				aria-label={
					typeof block.attrs.title === "string" &&
					block.attrs.title.trim() !== "" &&
					block.attrs.title.trim() !== wordsIn(block.locale)[tone]
						? wordsIn(block.locale)[tone]
						: undefined
				}
			>
				<div className="monti-block-callout-title" contentEditable={false}>
					<BlockTitle
						label={say(words.title)}
						value={typeof block.attrs.title === "string" ? block.attrs.title : ""}
						placeholder={wordsIn(block.locale)[tone]}
						onChange={(title) => block.setAttrs({ title: title === "" ? undefined : title })}
						onDone={() => block.focusChild(0)}
					/>
				</div>
				<BlockContent className="monti-block-callout-body" />
			</div>
		</BlockFrame>
	);
}
