import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PickList, PickListItem } from "./pick-list";

const KINDS = [
	{ value: "text", label: "글자" },
	{ value: "select", label: "고르기" },
	{ value: "media", label: "미디어" },
	{ value: "relation", label: "관계", mark: "→" },
];

function Demo({ initial = "text" }: { initial?: string }) {
	const [picked, setPicked] = useState(initial);
	return (
		<PickList aria-label="종류" className="w-40">
			{KINDS.map((kind) => (
				<PickListItem
					key={kind.value}
					selected={picked === kind.value}
					mark={kind.mark}
					onClick={() => setPicked(kind.value)}
				>
					{kind.label}
				</PickListItem>
			))}
		</PickList>
	);
}

/**
 * The kinds of a new field, as menu rows on the page: the picked one is on the selected ground in ink, the rest muted, and a row that opens more
 * ends in a mark. One pick, no card around the list.
 */
const meta = { title: "Controls/Menu/PickList", component: PickList, render: () => <Demo /> } satisfies Meta<
	typeof PickList
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The row with a mark picked. */
export const WithMark: Story = { render: () => <Demo initial="relation" /> };
