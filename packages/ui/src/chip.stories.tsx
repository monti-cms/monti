import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Chip } from "./chip";
import { Stack } from "./stack";

/** A condition that is on or a value that was picked, with a × to take it off. `proposal` marks one the assistant set and nobody has touched. */
const meta = { title: "Tabs/Chip", component: Chip, args: { children: "태그: 리액트" } } satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Plain, removable, and the proposal versions (a spark first, blue). */
export const States: Story = {
	render: () => (
		<Stack gap={16}>
			<Stack direction="row" gap={12} align="center" wrap>
				<Chip>언어: 한국어</Chip>
				<Chip onRemove={() => {}}>태그: 리액트</Chip>
				<Chip onRemove={() => {}}>글: 첫 번째 글</Chip>
			</Stack>
			<Stack direction="row" gap={12} align="center" wrap>
				<Chip proposal>요약 비어 있음</Chip>
				<Chip proposal onRemove={() => {}}>
					요약 비어 있음
				</Chip>
			</Stack>
		</Stack>
	),
};

function Removing() {
	const [items, setItems] = useState(["리액트", "타입스크립트", "CSS"]);
	return (
		<Stack direction="row" gap={12} wrap>
			{items.map((item) => (
				<Chip key={item} onRemove={() => setItems(items.filter((x) => x !== item))} removeLabel={`${item} 빼기`}>
					태그: {item}
				</Chip>
			))}
		</Stack>
	);
}

export const Removable: Story = { render: () => <Removing /> };
