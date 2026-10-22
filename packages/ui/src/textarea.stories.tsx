import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Text } from "./text";
import { Textarea } from "./textarea";

const meta = {
	title: "Controls/Textarea",
	component: Textarea,
	args: { placeholder: "글 요약" },
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack gap="comfortable">
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					placeholder
				</Text>
				<Textarea placeholder="글 요약" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					filled, grows with content
				</Text>
				<Textarea
					defaultValue={
						"검색 결과와 공유 카드에 보이는 요약이에요.\n두 줄이 넘어가면 입력창이 같이 늘어납니다.\n세 번째 줄."
					}
				/>
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					disabled
				</Text>
				<Textarea disabled defaultValue="수정할 수 없는 요약" />
			</Stack>
			<Stack gap="tight">
				<Text variant="caption" tone="muted">
					invalid
				</Text>
				<Textarea aria-invalid defaultValue="너무 긴 요약" />
			</Stack>
		</Stack>
	),
};

/** `sm` writes at the label size for compact panels; `mono` for code and source text. */
export const SizesAndMono: Story = {
	render: () => (
		<Stack gap="normal" className="max-w-sm">
			<Textarea size="sm" placeholder="작게: 패널 안의 메모" />
			<Textarea mono defaultValue={"export const a = 1;\nexport const b = 2;"} />
		</Stack>
	),
};
