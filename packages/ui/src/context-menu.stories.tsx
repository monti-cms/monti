import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "./context-menu";
import { Text } from "./text";

function Target({ children = "여기를 오른쪽 클릭하세요" }: { children?: string }) {
	return (
		<ContextMenuTrigger className="flex h-32 w-72 items-center justify-center rounded-monti-lg border border-monti-muted border-dashed">
			<Text tone="muted">{children}</Text>
		</ContextMenuTrigger>
	);
}

const meta = {
	title: "Overlays/ContextMenu",
	component: ContextMenu,
	args: {},
	render: (args) => (
		<ContextMenu {...args}>
			<Target />
			<ContextMenuContent>
				<ContextMenuItem>
					<Pencil aria-hidden />
					이름 바꾸기
				</ContextMenuItem>
				<ContextMenuItem>
					<Copy aria-hidden />
					복제
					<ContextMenuShortcut>⌘D</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem variant="danger">
					<Trash2 aria-hidden />
					휴지통으로 이동
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
} satisfies Meta<typeof ContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { open: true }, render: meta.render };

export const DisabledItems: Story = {
	render: () => (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuItem>미리보기</ContextMenuItem>
				<ContextMenuItem disabled>발행 취소</ContextMenuItem>
				<ContextMenuItem variant="danger" disabled>
					휴지통으로 이동
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	),
};

export const GroupsAndLabels: Story = {
	render: () => (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuGroup>
					<ContextMenuLabel>글</ContextMenuLabel>
					<ContextMenuItem>열기</ContextMenuItem>
					<ContextMenuItem>새 탭에서 열기</ContextMenuItem>
				</ContextMenuGroup>
				<ContextMenuSeparator />
				<ContextMenuGroup>
					<ContextMenuLabel inset>들여쓴 라벨</ContextMenuLabel>
					<ContextMenuItem inset>들여쓴 항목</ContextMenuItem>
				</ContextMenuGroup>
			</ContextMenuContent>
		</ContextMenu>
	),
};

function CheckboxDemo() {
	const [pinned, setPinned] = useState(true);
	return (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
					상단에 고정
				</ContextMenuCheckboxItem>
				<ContextMenuCheckboxItem checked disabled>
					발행됨
				</ContextMenuCheckboxItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export const CheckboxItems: Story = { render: () => <CheckboxDemo /> };

function RadioDemo() {
	const [status, setStatus] = useState("published");
	return (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuRadioGroup value={status} onValueChange={setStatus}>
					<ContextMenuRadioItem value="published">발행됨</ContextMenuRadioItem>
					<ContextMenuRadioItem value="draft">초안</ContextMenuRadioItem>
					<ContextMenuRadioItem value="scheduled" disabled>
						예약됨
					</ContextMenuRadioItem>
				</ContextMenuRadioGroup>
			</ContextMenuContent>
		</ContextMenu>
	);
}

export const RadioItems: Story = { render: () => <RadioDemo /> };

export const Submenu: Story = {
	render: () => (
		<ContextMenu open>
			<Target>글 목록의 한 줄</Target>
			<ContextMenuContent>
				<ContextMenuItem>링크 복사</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>다른 형식으로</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem>Markdown</ContextMenuItem>
						<ContextMenuItem>HTML</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
			</ContextMenuContent>
		</ContextMenu>
	),
};
