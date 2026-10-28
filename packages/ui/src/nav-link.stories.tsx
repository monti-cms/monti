import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NavLink, NavLinkHandle } from "./nav-link";

const COLLECTIONS = [
	{ id: "post", name: "게시글", dot: true },
	{ id: "memo", name: "메모", dot: false },
	{ id: "category", name: "카테고리", dot: false },
	{ id: "tag", name: "태그", dot: false },
	{ id: "series", name: "시리즈", dot: false },
];

function Rail({ handled = false }: { handled?: boolean }) {
	const [open, setOpen] = useState("post");
	return (
		<nav aria-label="컬렉션" className="flex w-[240px] flex-col gap-monti-2">
			{COLLECTIONS.map((item) => (
				<NavLink
					key={item.id}
					active={open === item.id}
					dot={item.dot ? "바뀜" : undefined}
					note={item.id}
					handle={handled ? <NavLinkHandle aria-label={`끌어서 순서 바꾸기: ${item.name}`} /> : undefined}
					onSelect={() => setOpen(item.id)}
				>
					{item.name}
				</NavLink>
			))}
		</nav>
	);
}

/**
 * The collections beside the settings editor: a plain link for each, its identifier at the end, a dot after the name of one that holds changes. The open
 * one is on the current ground.
 */
const meta = {
	title: "Primitives/NavLink",
	component: NavLink,
	args: { onSelect: () => undefined, children: "게시글" },
	render: () => <Rail />,
} satisfies Meta<typeof NavLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A rail whose links can be reordered: the handle shows in the left margin while the pointer is on the link. */
export const WithHandles: Story = { render: () => <Rail handled /> };
