import type { Meta, StoryObj } from "@storybook/react-vite";
import { List, ListItem } from "./index";

/** A list of short lines: `bullet` marks each with a dot, `none` is a plain column; `ordered` numbers them. */
const meta = {
	title: "Patterns/List/List",
	component: List,
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = (
	<>
		<ListItem>글 3개가 휴지통으로 가요</ListItem>
		<ListItem>번역 2개도 함께 가요</ListItem>
		<ListItem>30일 뒤에 영구 삭제돼요</ListItem>
	</>
);

export const Bullet: Story = { args: { children: items } };
export const Ordered: Story = { args: { ordered: true, children: items } };
export const Plain: Story = { args: { marker: "none", children: items } };
