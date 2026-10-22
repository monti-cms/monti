import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
	title: "Overlays/DropdownMenu",
	component: DropdownMenu,
	args: {},
	render: (args) => (
		<DropdownMenu {...args}>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				<MoreHorizontal aria-hidden />더 보기
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Pencil aria-hidden />
					이름 바꾸기
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Copy aria-hidden />
					복제
					<DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<Trash2 aria-hidden />
					휴지통으로 이동
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
} satisfies Meta<typeof DropdownMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = { args: { defaultOpen: true }, render: meta.render };

export const DisabledItems: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>글 작업</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>미리보기</DropdownMenuItem>
				<DropdownMenuItem disabled>발행 취소</DropdownMenuItem>
				<DropdownMenuItem variant="danger" disabled>
					휴지통으로 이동
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const GroupsAndLabels: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>내 계정</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuLabel>김하루</DropdownMenuLabel>
					<DropdownMenuItem>프로필</DropdownMenuItem>
					<DropdownMenuItem>설정</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel inset>들여쓴 라벨</DropdownMenuLabel>
					<DropdownMenuItem inset>들여쓴 항목</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">로그아웃</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

function CheckboxDemo() {
	const [showDrafts, setShowDrafts] = useState(true);
	const [showTrash, setShowTrash] = useState(false);
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>보기</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuCheckboxItem checked={showDrafts} onCheckedChange={setShowDrafts}>
					초안 보기
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked={showTrash} onCheckedChange={setShowTrash}>
					휴지통 보기
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked disabled>
					발행됨 (항상 표시)
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const CheckboxItems: Story = { render: () => <CheckboxDemo /> };

function RadioDemo() {
	const [order, setOrder] = useState("recent");
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>정렬</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={order} onValueChange={setOrder}>
					<DropdownMenuRadioItem value="recent">최근 수정순</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="title">제목순</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="old" disabled>
						오래된 순
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const RadioItems: Story = { render: () => <RadioDemo /> };

export const Submenu: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>내보내기</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>링크 복사</DropdownMenuItem>
				<DropdownMenuSub defaultOpen>
					<DropdownMenuSubTrigger>다른 형식으로</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>Markdown</DropdownMenuItem>
						<DropdownMenuItem>HTML</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

/** The content is capped at 20rem wide: a long label truncates by the cap instead of stretching the menu. */
export const LongLabel: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>글 고르기</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>아주 긴 제목의 글이 메뉴 안에서 어떻게 보이는지 확인하기 위한 제목입니다</DropdownMenuItem>
				<DropdownMenuItem>짧은 글</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};
