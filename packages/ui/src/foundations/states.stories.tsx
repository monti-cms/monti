import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { NavLink } from "../nav-link";
import { Stack } from "../stack";
import { Text } from "../text";
import { Group, Page, Spec } from "./shared";

/**
 * States (tokens.md, 상태): what cannot be pressed is 0.45 and does not answer the pointer; what stepped back for a moment is 0.6; the keyboard's focus
 * is one ring, 2px at half ink, outside a part that stands alone and inside a row that spans its box.
 */
const meta = { title: "Foundations/States" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Opacity: Story = {
	render: () => (
		<Page>
			<Group title="Opacity">
				<Spec
					name="disabled · 0.45"
					usage="disabled, aria-disabled: cannot be pressed, its reason in place (principle 7)"
				>
					<Button disabled>저장</Button>
				</Spec>
				<Spec name="dimmed · 0.6" usage="stepped back for a moment: a table reloading, a proposal left out">
					<Text className="opacity-60">다시 불러오는 중인 행</Text>
				</Spec>
			</Group>
		</Page>
	),
};

/**
 * The ring as the keyboard sees it, drawn here without focus: outside a button, inside a row that reaches its box's edges. A picture (`inert`): the
 * keyboard does not stop on it, and the measuring does not ask a drawn ring to change under a focus.
 */
export const Focus: Story = {
	render: () => (
		<Page>
			<div inert>
				<Group title="Focus ring · ring-2 ring-monti-contrast/50">
					<Spec name="outside" usage="a part that stands alone: a button, an icon button, a chip">
						<Button className="ring-2 ring-monti-contrast/50">저장</Button>
					</Spec>
					<Spec name="inside (ring-inset)" usage="a row that spans its box: sidebar, lists, status cells, table rows">
						<Stack className="w-56 overflow-hidden">
							<div className="rounded-monti-full ring-2 ring-monti-contrast/50 ring-inset">
								<NavLink note="post">게시글</NavLink>
							</div>
						</Stack>
					</Spec>
				</Group>
			</div>
		</Page>
	),
};
