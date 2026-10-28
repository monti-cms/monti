import type { Meta, StoryObj } from "@storybook/react-vite";
import { DotNote } from "./dot-note";

/** A quiet line led by a 6px dot: the state of what a panel shows. */
const meta = {
	title: "Patterns/Panel/DotNote",
	component: DotNote,
	args: { children: "휴지통 · 3일 남음 · 읽기 전용" },
} satisfies Meta<typeof DotNote>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
