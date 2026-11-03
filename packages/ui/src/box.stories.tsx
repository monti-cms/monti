import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { Box } from "./box";
import { LAYOUT } from "./layout";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";
import { Text } from "./text";

const meta = {
	title: "Primitives/Box",
	component: Box,
	args: { padding: 12, background: "muted", radius: "md" },
	render: (args) => (
		<Box {...args}>
			<Text variant="caption">상자 안의 내용</Text>
		</Box>
	),
} satisfies Meta<typeof Box>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

type Option = keyof typeof LAYOUT;

/** One option, every value side by side, each labelled with the option name and value. */
function Values({
	option,
	values,
	render,
}: {
	option: Option;
	values: readonly string[];
	render: (value: string) => React.ReactNode;
}) {
	return (
		<Stack direction="row" gap={24} wrap align="start">
			{values.map((value) => (
				<Stack key={value} gap={4}>
					<StoryCaption>
						{option} {value}
					</StoryCaption>
					{render(value)}
				</Stack>
			))}
		</Stack>
	);
}

const keys = (option: Option) => Object.keys(LAYOUT[option]);

export const Background: Story = {
	render: () => (
		<Values
			option="background"
			values={keys("background")}
			render={(value) => (
				<Box padding={12} border="all" width="menu" {...{ background: value as keyof typeof LAYOUT.background }}>
					<Text variant="caption">배경 면</Text>
				</Box>
			)}
		/>
	),
};

export const Border: Story = {
	render: () => (
		<Values
			option="border"
			values={keys("border")}
			render={(value) => (
				<Box padding={12} width="menu" {...{ border: value as keyof typeof LAYOUT.border }}>
					<Text variant="caption">테두리</Text>
				</Box>
			)}
		/>
	),
};

export const Radius: Story = {
	render: () => (
		<Values
			option="radius"
			values={keys("radius")}
			render={(value) => (
				<Box padding={12} background="muted" width="menu" {...{ radius: value as keyof typeof LAYOUT.radius }}>
					<Text variant="caption">모서리</Text>
				</Box>
			)}
		/>
	),
};

export const Dimmed: Story = {
	render: () => (
		<Stack direction="row" gap={24}>
			{[false, true].map((dimmed) => (
				<Stack key={String(dimmed)} gap={4}>
					<StoryCaption>dimmed {String(dimmed)}</StoryCaption>
					<Box dimmed={dimmed} padding={12} background="muted" radius="md">
						<Text variant="caption">불러오는 중인 내용</Text>
					</Box>
				</Stack>
			))}
		</Stack>
	),
};

/** `band`: a hairline and space above every item but the first. */
export const Band: Story = {
	render: () => (
		<Stack gap={4}>
			<StoryCaption>band true, 세 번 이어서</StoryCaption>
			<Box width="panel">
				{["첫째 구역", "둘째 구역", "셋째 구역"].map((name) => (
					<Box key={name} band paddingBottom={32}>
						<Text variant="caption">{name}</Text>
					</Box>
				))}
			</Box>
		</Stack>
	),
};
