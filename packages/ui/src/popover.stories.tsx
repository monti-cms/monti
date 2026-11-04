import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
	Text,
} from "./index";

/** A floating card for a small form or a note, or the card around a menu (`padding="menu"`). */
const meta = {
	title: "Controls/Overlay/Popover",
	component: Popover,
} satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A note: a title, a line under it, and one action. 300px (`md`, the default). */
export const Note: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger
				render={
					<Button variant="ghost" size="sm">
						정보
					</Button>
				}
			/>
			<PopoverContent>
				<PopoverHeader>
					<PopoverTitle>예약 발행</PopoverTitle>
					<PopoverDescription>11월 4일 오전 9:00에 사이트에 올라가요.</PopoverDescription>
				</PopoverHeader>
				<Button size="sm">예약 취소</Button>
			</PopoverContent>
		</Popover>
	),
};

/** The widths: `sm` 240px (a menu), `md` 300px (a panel), `lg` 380px (the assistant). */
export const Small: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger
				render={
					<Button variant="ghost" size="sm">
						sm
					</Button>
				}
			/>
			<PopoverContent width="sm">
				<Text variant="note">메뉴 폭의 카드예요.</Text>
			</PopoverContent>
		</Popover>
	),
};

export const Large: Story = {
	render: () => (
		<Popover defaultOpen>
			<PopoverTrigger
				render={
					<Button variant="ghost" size="sm">
						lg
					</Button>
				}
			/>
			<PopoverContent width="lg">
				<Text variant="note">어시스턴트 폭의 카드예요.</Text>
			</PopoverContent>
		</Popover>
	),
};
