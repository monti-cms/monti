import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePlus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "./command";
import { Stack } from "./stack";

const meta = {
	title: "Controls/Command",
	component: Command,
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;

function Body() {
	return (
		<>
			<CommandInput placeholder="명령 검색" />
			<CommandList>
				<CommandEmpty>맞는 명령이 없어요</CommandEmpty>
				<CommandGroup heading="글">
					<CommandItem>
						<FilePlus aria-hidden />새 글 쓰기<CommandShortcut>⌘N</CommandShortcut>
					</CommandItem>
					<CommandItem>
						<Trash2 aria-hidden />
						휴지통 비우기
					</CommandItem>
					<CommandItem disabled>
						<Trash2 aria-hidden />
						비활성 명령
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="설정">
					<CommandItem>
						<Settings aria-hidden />
						사이트 설정<CommandShortcut>⌘,</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</>
	);
}

export const Playground: Story = {
	render: (args) => (
		<Command {...args}>
			<Body />
		</Command>
	),
};

/** Filtered to nothing. */
export const Empty: Story = {
	render: () => (
		<Command>
			<CommandInput placeholder="명령 검색" value="없는 명령" />
			<CommandList>
				<CommandEmpty>맞는 명령이 없어요</CommandEmpty>
			</CommandList>
		</Command>
	),
};

/** A selected item (checked marker) next to items with shortcuts. */
export const SelectedItem: Story = {
	render: () => (
		<Command value="공개">
			<CommandList>
				<CommandGroup heading="상태">
					<CommandItem value="공개">공개</CommandItem>
					<CommandItem value="비공개">비공개</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	),
};

function DialogExample({ initiallyOpen }: { initiallyOpen: boolean }) {
	const [open, setOpen] = useState(initiallyOpen);
	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				명령 팔레트 열기
			</Button>
			<CommandDialog open={open} onOpenChange={setOpen} title="명령 팔레트" description="실행할 명령을 검색하세요">
				<Body />
			</CommandDialog>
		</>
	);
}

export const InDialog: Story = {
	render: () => <DialogExample initiallyOpen />,
};
