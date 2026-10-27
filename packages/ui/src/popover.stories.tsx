import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover";
import { Stack } from "./stack";

const meta = {
	title: "Controls/Overlay/Popover",
	component: Popover,
	args: {},
	render: (args) => (
		<Popover {...args}>
			<PopoverTrigger render={<Button variant="secondary" />}>슬러그 바꾸기</PopoverTrigger>
			<PopoverContent>
				<PopoverHeader>
					<PopoverTitle>슬러그</PopoverTitle>
					<PopoverDescription>주소에 쓰이는 이름이에요.</PopoverDescription>
				</PopoverHeader>
				<Input defaultValue="summer-trip" aria-label="슬러그" />
				<Button size="sm">적용</Button>
			</PopoverContent>
		</Popover>
	),
} satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

export const TitleOnly: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger render={<Button variant="secondary" />}>도움말</PopoverTrigger>
			<PopoverContent>
				<PopoverTitle>예약 발행</PopoverTitle>
			</PopoverContent>
		</Popover>
	),
};

export const Sides: Story = {
	render: () => (
		<Stack direction="row" gap={48} className="px-40 py-40">
			{(["top", "right", "bottom", "left"] as const).map((side) => (
				<Popover key={side} defaultOpen>
					<PopoverTrigger render={<Button variant="secondary" />}>{side}</PopoverTrigger>
					<PopoverContent side={side} className="w-40">
						<PopoverDescription>{side}에 열렸어요</PopoverDescription>
					</PopoverContent>
				</Popover>
			))}
		</Stack>
	),
};

export const LongText: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger render={<Button variant="secondary" />}>안내</PopoverTrigger>
			<PopoverContent>
				<PopoverHeader>
					<PopoverTitle>이 글을 발행하기 전에 확인해 주세요</PopoverTitle>
					<PopoverDescription>
						대표 이미지가 비어 있고 번역이 일부만 채워져 있어요. 그대로 발행해도 되지만 검색 결과에서 글이 덜 돋보일 수
						있어요.
					</PopoverDescription>
				</PopoverHeader>
			</PopoverContent>
		</Popover>
	),
};

/** The widths: `sm`, `md` (default), `lg`, `auto`; `padding="none"` for content that brings its own rows. */
export const Widths: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start">
			{(["sm", "md", "lg"] as const).map((width) => (
				<Popover key={width} open>
					<PopoverTrigger render={<Button variant="secondary" />}>{width}</PopoverTrigger>
					<PopoverContent width={width} side="bottom" align="start">
						{width} 너비의 팝오버
					</PopoverContent>
				</Popover>
			))}
		</Stack>
	),
};
