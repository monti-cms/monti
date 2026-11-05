import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./icon-button";
import { Renew } from "./icons";
import { Input } from "./input";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

const meta = {
	title: "Controls/Field/Input",
	component: Input,
	args: { placeholder: "글 제목" },
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Placeholder, filled, disabled, invalid (the underline turns red), proposal (the assistant wrote it: blue), and the other input types. */
export const States: Story = {
	render: () => (
		<Stack gap={16}>
			<Stack gap={4}>
				<StoryCaption>placeholder</StoryCaption>
				<Input placeholder="글 제목" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>filled</StoryCaption>
				<Input defaultValue="처음 쓰는 블로그 글" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>disabled</StoryCaption>
				<Input disabled defaultValue="슬러그는 잠겨 있어요" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>disabled, empty</StoryCaption>
				<Input disabled placeholder="슬러그" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>invalid</StoryCaption>
				<Input aria-invalid defaultValue="중복된 슬러그" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>proposal (written by the assistant, not yet touched)</StoryCaption>
				<Input proposal defaultValue="어시스턴트가 채운 제목" />
			</Stack>
			<Stack gap={4}>
				<StoryCaption>type=password</StoryCaption>
				<Input type="password" defaultValue="비밀번호" />
			</Stack>
		</Stack>
	),
};

/** The two sizes and fixed-width letters: `sm` beside 28px buttons, `default` in forms; `mono` for slugs and paths. */
export const SizesAndMono: Story = {
	render: () => (
		<Stack gap={12} className="max-w-sm">
			<Input size="sm" placeholder="작게: 필터, 표, 도구 모음" />
			<Input placeholder="기본: 폼" />
			<Input mono defaultValue="cms-elements-details" />
			<Input size="sm" mono defaultValue="/posts/:slug" />
		</Stack>
	),
};

/** Widths: `short` for a word, `number` for a short count, `fit` as wide as what it holds. */
export const Widths: Story = {
	render: () => (
		<Stack gap={12}>
			<Input width="short" defaultValue="노트" />
			<Input width="number" defaultValue="120" inputMode="numeric" />
			<Input width="fit" defaultValue="기본 정보" />
		</Stack>
	),
};

/** `inline` reads as text until focused, with no line: a name at the label size, a tab or group name (`title`), the post title (`display`), or the type of the text it stands in (`inherit`). */
export const Inline: Story = {
	render: () => (
		<Stack gap={16}>
			<Input appearance="inline" defaultValue="이름 바꾸기" aria-label="이름" />
			<Input size="title" defaultValue="기본 정보" aria-label="탭 이름" />
			<Input size="display" defaultValue="처음 쓰는 블로그 글" aria-label="제목" />
			<Input size="inherit" defaultValue="참고" aria-label="블록 제목" />
		</Stack>
	),
};

/** `action`: a button at the end of the line (make the address again from the title). The underline runs under it too, and turns ink or danger with the field. */
export const WithAction: Story = {
	render: () => (
		<Stack gap={24} className="max-w-sm">
			<Input
				size="sm"
				aria-label="주소"
				placeholder="제목에서 만들어요"
				mono
				action={
					<IconButton label="제목으로 다시 만들기">
						<Renew aria-hidden />
					</IconButton>
				}
			/>
			<Input
				size="sm"
				aria-label="주소"
				aria-invalid
				mono
				defaultValue="first post"
				action={
					<IconButton label="제목으로 다시 만들기">
						<Renew aria-hidden />
					</IconButton>
				}
			/>
		</Stack>
	),
};
