import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover";
import { Stack } from "./stack";

/**
 * A card that opens beside what was pressed: the page ground with an emphasis edge, the largest radius and the floating shadow. A small form or note
 * has 12px above and 16 at the sides and below; a list of rows (`padding="menu"`) has 6px, as a menu. Widths are the design system's: 240 (menu),
 * 300 (panel, the default) and 380 (assistant).
 */
const meta = {
	title: "Controls/Overlay/Popover",
	component: Popover,
	args: {},
	render: (args) => (
		<Popover {...args}>
			<PopoverTrigger render={<Button variant="secondary" />}>슬러그 바꾸기</PopoverTrigger>
			<PopoverContent align="start">
				<PopoverHeader>
					<PopoverTitle>슬러그</PopoverTitle>
					<PopoverDescription>주소에 쓰이는 이름이에요.</PopoverDescription>
				</PopoverHeader>
				<Input defaultValue="summer-trip" aria-label="슬러그" mono />
				<Stack direction="row" justify="end">
					<Button size="sm">적용</Button>
				</Stack>
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
			<PopoverContent align="start">
				<PopoverTitle>예약 발행</PopoverTitle>
			</PopoverContent>
		</Popover>
	),
};

/** Each side gets its own cell, with room for the card: the card opens on the side it is asked to, away from the other triggers. */
export const Sides: Story = {
	render: () => (
		<div className="grid grid-cols-2 gap-x-monti-48 gap-y-monti-32 p-monti-48">
			{(["top", "right", "bottom", "left"] as const).map((side) => (
				<div key={side} className="flex h-40 items-center justify-center">
					<Popover defaultOpen>
						<PopoverTrigger render={<Button variant="secondary" />}>{side}</PopoverTrigger>
						<PopoverContent side={side} className="w-40">
							<PopoverDescription>{side}에 열렸어요</PopoverDescription>
						</PopoverContent>
					</Popover>
				</div>
			))}
		</div>
	),
};

export const LongText: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger render={<Button variant="secondary" />}>안내</PopoverTrigger>
			<PopoverContent align="start">
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

const WIDTHS = [
	{ width: "sm", name: "메뉴 240" },
	{ width: "md", name: "패널 300" },
	{ width: "lg", name: "어시스턴트 380" },
] as const;

/** The three fixed widths, one per row with the card opening to the right of its trigger, so each is seen alone. */
export const Widths: Story = {
	render: () => (
		<Stack gap={16}>
			{WIDTHS.map(({ width, name }) => (
				<div key={width} className="flex h-24 items-start gap-monti-8">
					<Popover open>
						<PopoverTrigger render={<Button variant="secondary" />}>{width}</PopoverTrigger>
						<PopoverContent width={width} side="right" align="start">
							{name}
						</PopoverContent>
					</Popover>
				</div>
			))}
		</Stack>
	),
};
