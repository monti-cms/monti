import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../stack";
import { Text } from "../text";
import { classOf, Group, Page, px, Spec, tokens } from "./shared";

/** Color: the raw scales (gray 1-12 and the four tones) and the roles screens use, one name per property. Light and dark are the toolbar's theme switch. */
const meta = { title: "Foundations/Colors" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const colors = tokens.color.tokens;
/** Roles by property: `bg-tool` is the class `bg-monti-tool`. */
const roles = (prefix: string) => colors.filter(({ name }) => name.startsWith(`${prefix}-`));

/** The raw values: gray 1-12 and the four tones at steps 3 (soft fill) and 11 (text). Screens never use these; they use the roles. */
export const Scales: Story = {
	render: () => (
		<Page>
			{["gray", "success", "warning", "danger", "proposal"].map((family) => (
				<Group key={family} title={family}>
					{colors
						.filter(({ name }) => new RegExp(`^${family}-\\d+$`).test(name))
						.map(({ name, usage }) => (
							<Spec key={name} name={name} usage={usage}>
								<div className="h-12 rounded-monti-md border border-monti-muted" style={{ background: px(name) }} />
							</Spec>
						))}
				</Group>
			))}
		</Page>
	),
};

/** What screens paint with: the swatch shows the role, the line under it the class and what it is for. */
export const Roles: Story = {
	render: () => (
		<Page>
			<Group title="Background (bg-monti-*)">
				{roles("bg").map(({ name, usage }) => (
					<Spec key={name} name={classOf(name)} usage={usage}>
						<div className="h-12 rounded-monti-md border border-monti-muted" style={{ background: px(name) }} />
					</Spec>
				))}
			</Group>
			<Group title="Text (text-monti-*)">
				{roles("fg").map(({ name, usage }) => (
					<Spec key={name} name={classOf(name)} usage={usage}>
						<Stack gap={0} className="h-12 justify-center rounded-monti-md bg-monti-page">
							<Text variant="title" style={{ color: px(name) }}>
								가나다 Aa
							</Text>
						</Stack>
					</Spec>
				))}
			</Group>
			<Group title="Border (border-monti-*, also ring, outline, divide, decoration)">
				{roles("border").map(({ name, usage }) => (
					<Spec key={name} name={classOf(name)} usage={usage}>
						<div className="h-12 rounded-monti-md border-2" style={{ borderColor: px(name) }} />
					</Spec>
				))}
			</Group>
		</Page>
	),
};
