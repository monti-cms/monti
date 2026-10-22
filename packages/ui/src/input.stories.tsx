import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/Input",
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

/** Placeholder, filled, disabled, invalid, and the other input types. */
export const States: Story = {
	render: () => (
		<Stack gap="comfortable">
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					placeholder
				</Text>
				<Input placeholder="글 제목" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					filled
				</Text>
				<Input defaultValue="처음 쓰는 블로그 글" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					disabled
				</Text>
				<Input disabled defaultValue="슬러그는 잠겨 있어요" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					disabled, empty
				</Text>
				<Input disabled placeholder="슬러그" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					invalid
				</Text>
				<Input aria-invalid defaultValue="중복된 슬러그" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					type=password
				</Text>
				<Input type="password" defaultValue="비밀번호" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					type=file
				</Text>
				<Input type="file" />
			</Stack>
		</Stack>
	),
};
