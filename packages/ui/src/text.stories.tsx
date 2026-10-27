import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Heading, Text } from "./text";

const meta = {
	title: "Primitives/Text",
	component: Text,
	args: { children: "처음 쓰는 블로그 글", variant: "body", tone: "default", weight: "role" },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["micro", "caption", "label", "body", "reading", "title", "heading", "display"] as const;
const TONES = ["default", "muted", "subtle", "danger", "warning", "success", "inherit"] as const;
const WEIGHTS = ["role", "medium", "semibold"] as const;

export const AllVariants: Story = {
	render: () => (
		<Stack gap={12}>
			{VARIANTS.map((variant) => (
				<Text key={variant} as="div" variant={variant}>
					{variant} · 글을 쓰고 발행해 보세요
				</Text>
			))}
		</Stack>
	),
};

/** Every variant in every tone. */
export const VariantsByTone: Story = {
	render: () => (
		<Stack gap={16}>
			{VARIANTS.map((variant) => (
				<Stack key={variant} direction="row" gap={24} wrap align="baseline">
					{TONES.map((tone) => (
						<Text key={tone} variant={variant} tone={tone}>
							{variant} {tone}
						</Text>
					))}
				</Stack>
			))}
		</Stack>
	),
};

export const Weights: Story = {
	render: () => (
		<Stack gap={8}>
			{WEIGHTS.map((weight) => (
				<Text key={weight} as="div" weight={weight}>
					weight {weight} · 발행됨
				</Text>
			))}
		</Stack>
	),
};

export const Mono: Story = {
	render: () => (
		<Text as="code" mono variant="caption">
			/posts/summer-trip
		</Text>
	),
};

export const Truncate: Story = {
	render: () => (
		<div className="max-w-xs">
			<Text as="div" truncate>
				아주 긴 제목의 글이 한 줄에 다 들어가지 않으면 끝이 말줄임표로 잘려요
			</Text>
		</div>
	),
};

export const Elements: Story = {
	render: () => (
		<Stack gap={8}>
			<Text as="label" htmlFor="title" variant="label">
				제목
			</Text>
			<Text as="p" tone="muted">
				문단으로 쓰는 본문
			</Text>
			<Text as="time" variant="caption" tone="subtle">
				2026-10-22
			</Text>
		</Stack>
	),
};

const HEADING_VARIANTS = ["title", "heading", "display"] as const;

export const Headings: Story = {
	render: () => (
		<Stack gap={16}>
			{HEADING_VARIANTS.map((variant) => (
				<Heading key={variant} variant={variant}>
					{variant} · 여름 여행 기록
				</Heading>
			))}
		</Stack>
	),
};

export const HeadingsByTone: Story = {
	render: () => (
		<Stack gap={8}>
			{TONES.map((tone) => (
				<Heading key={tone} tone={tone}>
					title {tone}
				</Heading>
			))}
		</Stack>
	),
};

export const HeadingLevelsAndTruncate: Story = {
	render: () => (
		<Stack gap={8} className="max-w-xs">
			<Heading as="h1" variant="heading">
				h1 · 글
			</Heading>
			<Heading as="h3">h3 · 설정</Heading>
			<Heading as="h4" truncate>
				h4 · 아주 긴 제목이 한 줄에 다 들어가지 않으면 잘려요
			</Heading>
		</Stack>
	),
};
