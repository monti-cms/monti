import type { Meta, StoryObj } from "@storybook/react-vite";
import { Close } from "./icons";
import { DragHandle, IconButton, LanguageRow, LanguageSource, Stack, TextButton } from "./index";

/**
 * One content language in Settings › Languages: its name in itself, the code in mono and the display name. The source row ends in a bold "원문" and the
 * button that changes it; the others have a handle and a quiet ×.
 */
const meta = {
	title: "Patterns/List/LanguageRow",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const remove = (
	<IconButton label="빼기">
		<Close />
	</IconButton>
);

/** The source, an added language with its change dot, and one taken out (struck through). Every row is 36px; the × and the small button sit in it with no margins. */
export const Languages: Story = {
	render: () => (
		<Stack as="ul" gap={0} width="content">
			<LanguageRow name="한국어" code="ko" handled>
				<LanguageSource flag="원문">
					<TextButton variant="underline">바꾸기</TextButton>
				</LanguageSource>
			</LanguageRow>
			<LanguageRow name="English" code="en" label="영어" handled handle={<DragHandle aria-label="끌어서 옮기기" />}>
				{remove}
			</LanguageRow>
			<LanguageRow
				name="日本語"
				code="ja"
				label="일본어"
				dot="새 언어"
				handled
				handle={<DragHandle aria-label="끌어서 옮기기" />}
			>
				{remove}
			</LanguageRow>
			<LanguageRow
				name="Deutsch"
				code="de"
				label="독일어"
				gone
				handled
				handle={<DragHandle aria-label="끌어서 옮기기" />}
			>
				{remove}
			</LanguageRow>
		</Stack>
	),
};

/** A list that cannot be edited (the live site): a lock after every language, only the flag at the end, no handles or ×. */
export const Locked: Story = {
	render: () => (
		<Stack as="ul" gap={0} width="content">
			<LanguageRow name="한국어" code="ko" locked="운영 사이트에서는 잠김">
				<LanguageSource flag="원문" />
			</LanguageRow>
			<LanguageRow name="English" code="en" label="영어" locked="운영 사이트에서는 잠김" />
		</Stack>
	),
};

/** A language the assistant proposed and nobody has taken yet: its dot is the blue one. */
export const Proposed: Story = {
	render: () => (
		<Stack as="ul" gap={0} width="content">
			<LanguageRow name="한국어" code="ko" handled>
				<LanguageSource flag="원문" />
			</LanguageRow>
			<LanguageRow
				name="Deutsch"
				code="de"
				label="독일어"
				dot="추가"
				dotTone="proposal"
				handled
				handle={<DragHandle aria-label="끌어서 옮기기" />}
			>
				{remove}
			</LanguageRow>
		</Stack>
	),
};
