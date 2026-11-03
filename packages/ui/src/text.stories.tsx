import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { tokens } from "./foundations/shared";
import { Stack } from "./stack";
import { Heading, Text } from "./text";

const meta = {
	title: "Primitives/Text",
	component: Text,
	args: { children: "처음 쓰는 블로그 글", variant: "body", tone: "default", weight: "role" },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;
type Role = NonNullable<ComponentProps<typeof Text>["variant"]>;

export const Playground: Story = {};

// Every role of the design system, from tokens.json, so a role added there shows up here.
const VARIANTS = tokens.type.groups.flatMap((group) =>
	group.styles.map((style) => style.name.replace("text-", "") as Role),
);

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

const HEADING_VARIANTS = ["label", "title", "page", "heading", "display"] as const;

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
