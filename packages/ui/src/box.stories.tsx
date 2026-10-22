import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { Box } from "./box";
import { LAYOUT } from "./layout";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/Box",
	component: Box,
	args: { padding: "normal", background: "neutral", radius: "md" },
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
		<Stack direction="row" gap="spacious" wrap align="start">
			{values.map((value) => (
				<Stack key={value} gap="tight">
					<Text variant="label" tone="muted">
						{option} {value}
					</Text>
					{render(value)}
				</Stack>
			))}
		</Stack>
	);
}

const keys = (option: Option) => Object.keys(LAYOUT[option]);

export const Padding: Story = {
	render: () => (
		<Stack gap="spacious">
			{(["padding", "paddingX", "paddingY", "paddingTop", "paddingBottom"] as const).map((option) => (
				<Values
					key={option}
					option={option}
					values={keys(option)}
					render={(value) => (
						<Box background="inset" width="fit" {...{ [option]: value }}>
							<Box background="neutral" padding="tight">
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
				<Box
					padding="normal"
					border="all"
					width="panel-sm"
					{...{ background: value as keyof typeof LAYOUT.background }}
				>
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
				<Box padding="normal" width="panel-sm" {...{ border: value as keyof typeof LAYOUT.border }}>
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
				<Box
					padding="normal"
					background="neutral"
					width="panel-sm"
					{...{ radius: value as keyof typeof LAYOUT.radius }}
				>
					<Text variant="caption">모서리</Text>
				</Box>
			)}
		/>
	),
};

export const Width: Story = {
	render: () => (
		<Stack gap="normal">
			{keys("width").map((value) => (
				<Stack key={value} gap="tight">
					<Text variant="label" tone="muted">
						width {value}
					</Text>
					<Box background="inset" padding="tight">
						<Box background="neutral" padding="condensed" width={value as keyof typeof LAYOUT.width}>
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
		<Stack gap="normal">
			{keys("maxWidth").map((value) => (
				<Stack key={value} gap="tight">
					<Text variant="label" tone="muted">
						maxWidth {value}
					</Text>
					<Box background="inset" padding="tight">
						<Box background="neutral" padding="condensed" maxWidth={value as keyof typeof LAYOUT.maxWidth}>
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

const LONG = Array.from({ length: 40 }, (_, i) => `${i + 1}번째 줄`);

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
					width="panel-sm"
					maxHeight={value as keyof typeof LAYOUT.maxHeight}
					padding="condensed"
				>
					{LONG.map((line) => (
						<Text key={line} variant="caption">
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
				<Box position="relative" background="inset" radius="md" width="panel-sm" height="control" padding="normal">
					<Box
						as="span"
						background="accent-muted"
						radius="sm"
						paddingX="tight"
						place={value as keyof typeof LAYOUT.place}
					>
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
		<Stack gap="tight" align="start">
			<Text variant="label" tone="muted">
				hover true (포인터를 올려 보세요)
			</Text>
			<Box hover padding="normal" radius="md" border="all" width="panel">
				<Text variant="caption">마우스를 올리면 색이 바뀌어요</Text>
			</Box>
			<Text variant="label" tone="muted">
				hover 없음
			</Text>
			<Box padding="normal" radius="md" border="all" width="panel">
				<Text variant="caption">변하지 않아요</Text>
			</Box>
		</Stack>
	),
};

export const Dimmed: Story = {
	render: () => (
		<Stack direction="row" gap="spacious">
			{[false, true].map((dimmed) => (
				<Stack key={String(dimmed)} gap="tight">
					<Text variant="label" tone="muted">
						dimmed {String(dimmed)}
					</Text>
					<Box dimmed={dimmed} padding="normal" background="neutral" radius="md">
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
		<Stack gap="tight">
			<Text variant="label" tone="muted">
				band true, 세 번 이어서
			</Text>
			<Box width="panel">
				{["첫째 구역", "둘째 구역", "셋째 구역"].map((name) => (
					<Box key={name} band paddingBottom="wide">
						<Text variant="caption">{name}</Text>
					</Box>
				))}
			</Box>
		</Stack>
	),
};

export const Centered: Story = {
	render: () => (
		<Stack gap="normal">
			{[false, true].map((centered) => (
				<Stack key={String(centered)} gap="tight">
					<Text variant="label" tone="muted">
						centered {String(centered)}
					</Text>
					<Box background="inset" padding="tight">
						<Box centered={centered} width="panel" background="neutral" padding="condensed">
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
			values={["auto", "control", "control-sm"]}
			render={(value) => (
				<Box
					background="neutral"
					radius="md"
					paddingX="normal"
					width="panel-sm"
					height={value as keyof typeof LAYOUT.height}
				>
					<Text variant="caption">높이</Text>
				</Box>
			)}
		/>
	),
};

export const Overflow: Story = {
	render: () => (
		<Values
			option="overflow"
			values={keys("overflow")}
			render={(value) => (
				<Box
					border="all"
					radius="md"
					width="panel-sm"
					height="control"
					overflow={value as keyof typeof LAYOUT.overflow}
				>
					<Box padding="condensed" width="panel-lg" height="screen">
						<Text variant="caption">넘치는 내용은 값에 따라 잘리거나 스크롤돼요</Text>
					</Box>
				</Box>
			)}
		/>
	),
};

export const Elements: Story = {
	render: () => (
		<Stack gap="tight" align="start">
			{(["div", "section", "article", "aside", "header", "footer", "nav", "span"] as const).map((as) => (
				<Box key={as} as={as} padding="condensed" background="neutral" radius="md">
					<Text variant="caption">as {as}</Text>
				</Box>
			))}
		</Stack>
	),
};
