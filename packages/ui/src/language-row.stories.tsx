import type { Meta, StoryObj } from "@storybook/react-vite";
import { LanguageRow, LanguageRowHandle, LanguageSource } from "./language-row";
import { TextButton } from "./text-button";

/**
 * A content language: its name in itself, the code in mono, the display name when it differs. The source row sits first with the bold flag and the quiet
 * underlined change button at its end; the other rows have a drag handle and a quiet ×. A change dot marks a row that is new or whose role changed.
 */
const meta = {
	title: "Controls/List/LanguageRow",
	component: LanguageRow,
	args: { name: "한국어", code: "ko" },
	decorators: [
		(Story) => (
			<ul className="max-w-[560px]">
				<Story />
			</ul>
		),
	],
} satisfies Meta<typeof LanguageRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const source = (
	<LanguageSource flag="원문">
		<TextButton variant="underline" quiet size="note">
			바꾸기
		</TextButton>
	</LanguageSource>
);
const remove = (name: string) => (
	<TextButton variant="quiet" aria-label={`${name} 빼기`}>
		×
	</TextButton>
);

export const Playground: Story = {
	render: (args) => <LanguageRow {...args}>{source}</LanguageRow>,
};

/** An editable list: the source row keeps the handle's column empty. */
export const List: Story = {
	render: () => (
		<>
			<LanguageRow name="한국어" code="ko" label="한국어" handled>
				{source}
			</LanguageRow>
			<LanguageRow
				name="English"
				code="en"
				label="영어"
				handled
				handle={<LanguageRowHandle aria-label="English 끌어서 순서 바꾸기" />}
			>
				{remove("English")}
			</LanguageRow>
			<LanguageRow
				name="日本語"
				code="ja"
				label="일본어"
				dot="새로"
				handled
				handle={<LanguageRowHandle aria-label="日本語 끌어서 순서 바꾸기" />}
			>
				{remove("日本語")}
			</LanguageRow>
		</>
	),
};

/** A language taken out and not saved yet: it stays in the list, struck through, until the draft is saved or the change is undone. */
export const Gone: Story = {
	render: () => (
		<>
			<LanguageRow name="한국어" code="ko" label="한국어" handled>
				{source}
			</LanguageRow>
			<LanguageRow name="English" code="en" label="영어" dot="뺄 예정" gone handled />
		</>
	),
};

/** The source changed: both rows carry the dot. */
export const SourceChanged: Story = {
	render: () => (
		<>
			<LanguageRow name="English" code="en" label="영어" dot="원문 바뀜" handled>
				{source}
			</LanguageRow>
			<LanguageRow
				name="한국어"
				code="ko"
				label="한국어"
				dot="원문 바뀜"
				handled
				handle={<LanguageRowHandle aria-label="한국어 끌어서 순서 바꾸기" />}
			>
				{remove("한국어")}
			</LanguageRow>
		</>
	),
};

/** A list that cannot be edited: no handles, no ×, and only the flag on the source row. */
export const ReadOnly: Story = {
	render: () => (
		<>
			<LanguageRow name="한국어" code="ko" label="한국어">
				<LanguageSource flag="원문" />
			</LanguageRow>
			<LanguageRow name="English" code="en" label="영어" />
		</>
	),
};
