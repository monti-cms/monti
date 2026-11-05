import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { NavLink } from "../nav-link";
import { Text } from "../text";
import { TextButton } from "../text-button";
import { Group, Page, px, Spec, tokens } from "./shared";

/** Corner radius, `rounded-monti-*`: sm for marks, md for rows, lg for inner boxes, xl for floating panels, full for every pill. */
const meta = { title: "Foundations/Radius" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
	render: () => (
		<Page>
			<Group title="rounded-monti-*">
				{tokens.radius.tokens.map(({ name, value, usage }) => (
					<Spec key={name} name={`rounded-monti-${name.replace("radius-", "")} · ${value}`} usage={usage}>
						<div className="h-12 border border-monti-emphasis bg-monti-muted" style={{ borderRadius: px(name) }} />
					</Spec>
				))}
			</Group>
		</Page>
	),
};

/** The shape rule (button.md, 모양 기준): where a pressable thing sits decides its shape, not the part. */
export const Shapes: Story = {
	render: () => (
		<Page>
			<Group title="Pill · one line on the page ground">
				<Spec name="Button" usage="every button">
					<Button variant="secondary">미리보기</Button>
				</Spec>
				<Spec name="NavLink, sidebar rows" usage="a one-line row that is picked or pointed at">
					<div className="w-56">
						<NavLink active note="post">
							게시글
						</NavLink>
					</div>
				</Spec>
			</Group>
			<Group title="6px · in a floating surface, or taller than a line">
				<Spec
					name="menu row, tile, conversation row"
					usage="follows the surface's corners; a pill would turn into an oval"
				>
					<div className="flex h-monti-control-md w-56 items-center rounded-monti-md bg-monti-selected px-monti-10">
						<Text>위로</Text>
					</div>
				</Spec>
			</Group>
			<Group title="No shape · lays no ground, or spans the row">
				<Spec
					name="TextButton, tabs, table rows"
					usage="an underline or ink when pointed at; a row's ground goes edge to edge"
				>
					<TextButton variant="underline">목록에서 보기</TextButton>
				</Spec>
			</Group>
		</Page>
	),
};
