import type { Meta, StoryObj } from "@storybook/react-vite";
import { Launch } from "./icons";
import {
	Button,
	DescriptionItem,
	DescriptionList,
	FilePreview,
	FormField,
	FormFieldLabel,
	IconButton,
	Input,
	SidePanel,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
} from "./index";

/** A panel beside a screen, for what is looked at with it: cream ground, a line down its left edge, a 60px head with the title and ×. */
const meta = {
	title: "Controls/Overlay/SidePanel",
	component: SidePanel,
	parameters: { bleed: true },
	args: { onClose: () => {} },
} satisfies Meta<typeof SidePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `side` (360px): a media file beside the grid, with an icon button in the head and the one pill in the foot. */
export const File: Story = {
	args: {
		title: "cover-2026.png",
		width: "side",
		actions: (
			<IconButton label="새 탭에서 열기">
				<Launch />
			</IconButton>
		),
		footer: <Button size="sm">저장</Button>,
		children: (
			<>
				<FilePreview ext="PNG" framed />
				<FormField>
					<FormFieldLabel htmlFor="alt">대체 텍스트</FormFieldLabel>
					<Input id="alt" defaultValue="봄 햇살이 드는 책상" />
				</FormField>
				<DescriptionList>
					<DescriptionItem label="종류">PNG 이미지</DescriptionItem>
					<DescriptionItem label="크기">1600×900 · 412KB</DescriptionItem>
					<DescriptionItem label="올린 날">2026. 10. 28</DescriptionItem>
				</DescriptionList>
			</>
		),
	},
};

/** `panel` (300px) without a head: the tab bar is the top row (the properties panel). */
export const Bar: Story = {
	args: {
		width: "panel",
		"aria-label": "속성",
		onClose: undefined,
		bar: (
			<Tabs defaultValue="props">
				<TabsList variant="bar">
					<TabsTrigger value="props">속성</TabsTrigger>
					<TabsTrigger value="seo">검색 노출</TabsTrigger>
				</TabsList>
			</Tabs>
		),
		children: <Text variant="note">속성 목록</Text>,
	},
};

/** A view inside the panel goes back with a button before the title. */
export const Back: Story = {
	args: {
		title: "지난 대화",
		width: "assistant",
		back: { label: "대화로 돌아가기", onClick: () => {} },
		children: <Text variant="note">대화 목록</Text>,
	},
};
