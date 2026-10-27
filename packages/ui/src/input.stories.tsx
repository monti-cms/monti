import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Field/Input",
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
				<Text variant="caption" tone="muted">
					placeholder
				</Text>
				<Input placeholder="글 제목" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					filled
				</Text>
				<Input defaultValue="처음 쓰는 블로그 글" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					disabled
				</Text>
				<Input disabled defaultValue="슬러그는 잠겨 있어요" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					disabled, empty
				</Text>
				<Input disabled placeholder="슬러그" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					invalid
				</Text>
				<Input aria-invalid defaultValue="중복된 슬러그" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					proposal (written by the assistant, not yet touched)
				</Text>
				<Input proposal defaultValue="어시스턴트가 채운 제목" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					type=password
				</Text>
				<Input type="password" defaultValue="비밀번호" />
			</Stack>
			<Stack gap={4}>
				<Text variant="caption" tone="muted">
					type=file
				</Text>
				<Input type="file" />
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
