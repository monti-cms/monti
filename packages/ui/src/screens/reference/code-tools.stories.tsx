import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	CodeBoxScreen,
	CodeLinkScreen,
	FormatInCodeScreen,
	LanguageScreen,
	LineMenuScreen,
	RulesScreen,
} from "./code-tools";

/** The code block in the editor (doc 17): the old code block the owner used (`b612824d`) with the owner's seven points, made of design-system parts. */
const meta = {
	title: "Screens/Reference/CodeTools",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Writing: the file name's tab, the head row (language, then 줄 효과 · 정규식 규칙 · 줄 번호 · 코드 복사), effects on lines, a fold open. */
export const Box: Story = { render: () => <CodeBoxScreen state="writing" /> };
/** The fold closed: one row "접힌 4줄" in place of its lines. */
export const Folded: Story = { render: () => <CodeBoxScreen state="folded" /> };
/** The site hides line numbers: 줄 번호 not pressed, the numbers fainter. */
export const NumbersOff: Story = { render: () => <CodeBoxScreen state="numbersOff" /> };
/** An archived entry: the language and file name as words, copy only. */
export const ReadOnly: Story = { render: () => <CodeBoxScreen state="readOnly" /> };
/** An imported block in a language the site does not list: its name as it is, plain code, nothing more. */
export const UnknownLanguage: Story = { render: () => <CodeBoxScreen state="unknown" /> };
/** A block with no file name: the tab's field, empty. */
export const NoFileName: Story = { render: () => <CodeBoxScreen state="noName" /> };
/** Just copied: the check mark. */
export const Copied: Story = { render: () => <CodeBoxScreen state="copied" /> };
/** The language list: the code small after each name, ✓ alone at the end. */
export const Language: Story = { render: () => <LanguageScreen state="open" /> };
export const LanguageTyped: Story = { render: () => <LanguageScreen state="typed" /> };
export const LanguageNone: Story = { render: () => <LanguageScreen state="none" /> };
/** A language the list does not have: nothing checked. */
export const LanguageUnknown: Story = { render: () => <LanguageScreen state="unknown" /> };
/** Lines 5–6 picked by dragging on their numbers; the menu opened on release, beside them. */
export const LineMenu: Story = { render: () => <LineMenuScreen state="picked" /> };
/** The picked lines are a fold: 접기 해제 · 처음부터 펼치기. */
export const LineMenuFold: Story = { render: () => <LineMenuScreen state="fold" /> };
/** Line 4 picked, a code link's target: "본문 연결" checked, with the words that point here. */
export const LineMenuLinked: Story = { render: () => <LineMenuScreen state="linked" /> };
/** Words picked in code: the editor's format card, its ⋯ open on the code's own marks. */
export const FormatInCode: Story = { render: () => <FormatInCodeScreen state="more" /> };
/** ⋯ › 툴팁: the tooltip's card, one plain field. */
export const TooltipInCode: Story = { render: () => <FormatInCodeScreen state="tooltip" /> };
/** ⋯ › 글자 접기: folded or open at first on the site. */
export const FoldInCode: Story = { render: () => <FormatInCodeScreen state="fold" /> };
/** Words with a tooltip and folded words in code; the eraser takes marks off. */
export const MarkedInCode: Story = { render: () => <FormatInCodeScreen state="marked" /> };
/** The rules card: one row per rule, then 규칙 추가. */
export const Rules: Story = { render: () => <RulesScreen state="list" /> };
/** No rule yet: only 규칙 추가. */
export const RulesEmpty: Story = { render: () => <RulesScreen state="empty" /> };
/** One rule: its fields one per row, the match count under the pattern. */
export const Rule: Story = { render: () => <RulesScreen state="rule" /> };
/** A tooltip rule in one line, with a pattern that does not read. */
export const RuleTooltip: Story = { render: () => <RulesScreen state="tooltip" /> };
/** Making a code link: the strip at the top of the screen asks for the lines. */
export const CodeLinkPicking: Story = { render: () => <CodeLinkScreen state="picking" /> };
/** Both sides picked: 연결. */
export const CodeLinkReady: Story = { render: () => <CodeLinkScreen state="ready" /> };
/** A link pointed at: its line lit. */
export const CodeLinked: Story = { render: () => <CodeLinkScreen state="linked" /> };
/** The link's card: go to the line, or take the link off. */
export const CodeLinkCard: Story = { render: () => <CodeLinkScreen state="card" /> };
/** A link whose lines are gone: red wavy line, its card, the to-do that stops the publish. */
export const CodeLinkBroken: Story = { render: () => <CodeLinkScreen state="broken" /> };
