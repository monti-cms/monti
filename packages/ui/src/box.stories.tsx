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

export const Padding: Story = {
	render: () => (
		<Stack gap={24}>
			{(["padding", "paddingX", "paddingY", "paddingTop", "paddingBottom"] as const).map((option) => (
				<Values
					key={option}
					option={option}
					values={keys(option)}
					render={(value) => (
						<Box background="tool" width="fit" {...{ [option]: value }}>
							<Box background="muted" padding={4}>
								<Text variant="caption">내용</Text>
							</Box>
						</Box>
					)}
				/>
			))}
		</Stack>
	),
};

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

export const Width: Story = {
	render: () => (
		<Stack gap={12}>
			{keys("width").map((value) => (
				<Stack key={value} gap={4}>
					<StoryCaption>width {value}</StoryCaption>
					<Box border="all" padding={4} width="full">
						<Box background="selected" padding={8} width={value as keyof typeof LAYOUT.width}>
							<Text variant="caption">너비</Text>
						</Box>
					</Box>
				</Stack>
			))}
		</Stack>
	),
};

export const MaxWidth: Story = {
	render: () => (
		<Stack gap={12}>
			{keys("maxWidth").map((value) => (
				<Stack key={value} gap={4}>
					<StoryCaption>maxWidth {value}</StoryCaption>
					<Box border="all" padding={4} width="full">
						<Box background="selected" padding={8} maxWidth={value as keyof typeof LAYOUT.maxWidth}>
							<Text variant="caption">
								긴 글은 최대 너비에서 줄이 바뀌어요. 긴 글은 최대 너비에서 줄이 바뀌어요. 긴 글은 최대 너비에서 줄이
								바뀌어요. 긴 글은 최대 너비에서 줄이 바뀌어요. 긴 글은 최대 너비에서 줄이 바뀌어요. 긴 글은 최대
								너비에서 줄이 바뀌어요.
							</Text>
						</Box>
					</Box>
				</Stack>
			))}
		</Stack>
	),
};

const LONG = Array.from({ length: 60 }, (_, i) => `${i + 1}번째 줄`);

export const MaxHeight: Story = {
	render: () => (
		<Values
			option="maxHeight"
			values={keys("maxHeight")}
			render={(value) => (
				<Box
					border="all"
					radius="md"
					overflow="y"
					width="menu"
					maxHeight={value as keyof typeof LAYOUT.maxHeight}
					padding={8}
				>
					{LONG.map((line) => (
						<Text key={line} as="div" variant="caption">
							{line}
						</Text>
					))}
				</Box>
			)}
		/>
	),
};

/** `place` pins a child to a corner of the nearest `position="relative"` parent. */
export const Place: Story = {
	render: () => (
		<Values
			option="place"
			values={keys("place")}
			render={(value) => (
				<Box position="relative" background="tool" radius="md" width="menu" className="h-24">
					<Box as="span" background="selected" radius="sm" paddingX={4} place={value as keyof typeof LAYOUT.place}>
						<Text as="span" variant="caption">
							표시
						</Text>
					</Box>
				</Box>
			)}
		/>
	),
};

/** `hover` tints the row under the pointer. */
export const Hover: Story = {
	render: () => (
		<Stack gap={4} align="start">
			<StoryCaption>hover true (포인터를 올려 보세요)</StoryCaption>
			<Box hover padding={12} radius="md" border="all" width="panel">
				<Text variant="caption">마우스를 올리면 색이 바뀌어요</Text>
			</Box>
			<StoryCaption>hover 없음</StoryCaption>
			<Box padding={12} radius="md" border="all" width="panel">
				<Text variant="caption">변하지 않아요</Text>
			</Box>
		</Stack>
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

export const Centered: Story = {
	render: () => (
		<Stack gap={12}>
			{[false, true].map((centered) => (
				<Stack key={String(centered)} gap={4}>
					<StoryCaption>centered {String(centered)}</StoryCaption>
					<Box background="tool" padding={4}>
						<Box centered={centered} width="panel" background="muted" padding={8}>
							<Text variant="caption">가운데 열</Text>
						</Box>
					</Box>
				</Stack>
			))}
		</Stack>
	),
};

export const Height: Story = {
	render: () => (
		<Values
			option="height"
			values={["auto", "control-md", "control-sm", "icon-button"]}
			render={(value) => (
				<Box background="muted" radius="md" paddingX={12} width="menu" height={value as keyof typeof LAYOUT.height}>
					<Text variant="caption">높이</Text>
				</Box>
			)}
		/>
	),
};

/**
 * Shows `overflow` cutting its content, so the visual check on clipped text lets this one through. The frame is smaller than the block inside it in both
 * directions: `hidden` and `clip` cut the block off, `auto` scrolls both ways, `y` and `x` only one (the scrollbars show while the pointer is over the frame).
 */
export const Overflow: Story = {
	tags: ["visual-allow-clipped"],
	render: () => (
		<Values
			option="overflow"
			values={keys("overflow")}
			render={(value) => (
				<Box border="all" radius="md" width="menu" className="h-24" overflow={value as keyof typeof LAYOUT.overflow}>
					<Box padding={8} className="w-max whitespace-nowrap">
						{[
							"첫 줄: 이 줄은 틀보다 훨씬 길어서 오른쪽 끝이 잘려요",
							"둘째 줄",
							"셋째 줄",
							"넷째 줄",
							"다섯째 줄",
							"여섯째 줄",
						].map((line) => (
							<Text key={line} as="div" variant="caption">
								{line}
							</Text>
						))}
					</Box>
				</Box>
			)}
		/>
	),
};

export const Elements: Story = {
	render: () => (
		<Stack gap={4} align="start">
			{(["div", "section", "article", "aside", "header", "footer", "nav", "span"] as const).map((as) => (
				<Box key={as} as={as} padding={8} background="muted" radius="md">
					<Text variant="caption">as {as}</Text>
				</Box>
			))}
		</Stack>
	),
};
