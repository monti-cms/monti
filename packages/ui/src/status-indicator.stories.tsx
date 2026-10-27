import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { StatusIndicator, type StatusShape, type StatusTone } from "./status-indicator";
import { Text } from "./text";

const meta = {
	title: "Feedback/StatusIndicator",
	component: StatusIndicator,
	args: { tone: "success", shape: "dot", size: "md", label: "발행됨" },
} satisfies Meta<typeof StatusIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const TONES: StatusTone[] = ["success", "warning", "danger", "neutral", "strong"];
const SHAPES: StatusShape[] = ["dot", "ring", "dashed", "half", "minus"];
const SIZES = ["sm", "md"] as const;

/** Every shape in every tone, with its label. */
export const ShapesByTone: Story = {
	render: () => (
		<Stack gap={16}>
			{TONES.map((tone) => (
				<Stack key={tone} direction="row" gap={24} align="center">
					{SHAPES.map((shape) => (
						<StatusIndicator key={shape} tone={tone} shape={shape} label={`${tone} · ${shape}`} />
					))}
				</Stack>
			))}
		</Stack>
	),
};

export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			{SIZES.map((size) => (
				<StatusIndicator key={size} size={size} tone="warning" shape="half" label={`size ${size}`} />
			))}
		</Stack>
	),
};

/** Without a label the marker is decorative (`aria-hidden`); the meaning has to come from the surroundings. */
export const WithoutLabel: Story = {
	render: () => (
		<Stack direction="row" gap={8} align="center">
			{TONES.map((tone) => (
				<StatusIndicator key={tone} tone={tone} />
			))}
		</Stack>
	),
};

export const Pulse: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<StatusIndicator tone="warning" shape="dot" size="sm" pulse label="저장 중" />
			<StatusIndicator tone="success" shape="dot" size="sm" label="저장됨" />
			<StatusIndicator tone="danger" shape="dot" size="sm" label="저장하지 못했어요" />
		</Stack>
	),
};

/** The markers as an entry list shows them. */
export const InAList: Story = {
	render: () => (
		<Stack gap={8}>
			<Stack direction="row" gap={8} align="center">
				<StatusIndicator tone="strong" shape="dot" label="발행됨" />
				<Text tone="muted">처음 쓰는 블로그 글</Text>
			</Stack>
			<Stack direction="row" gap={8} align="center">
				<StatusIndicator tone="strong" shape="ring" label="초안" />
				<Text tone="muted">여름 여행 기록</Text>
			</Stack>
			<Stack direction="row" gap={8} align="center">
				<StatusIndicator tone="warning" shape="half" label="수정 중" />
				<Text tone="muted">이사 후기</Text>
			</Stack>
		</Stack>
	),
};
