import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./index";

/** Text shown as it is, in the inner box (muted ground, no border): a JSON value, an error's details, a model's answer. */
const meta = {
	title: "Patterns/Frame/CodeBlock",
	component: CodeBlock,
} satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

const JSON_VALUE = JSON.stringify(
	{
		event: "entry.published",
		entry: { id: "first-spring", title: "봄에 쓴 첫 글", locale: "ko" },
		sentAt: "2026-11-03T06:12:00Z",
	},
	null,
	2,
);

/** `caption` (the default), long lines wrap, scrolling past 384px. */
export const Wrapped: Story = { args: { children: JSON_VALUE } };

/** `note` size, no wrap. */
export const NoWrap: Story = {
	args: {
		size: "note",
		wrap: false,
		children: "curl -X POST https://hooks.monti.blog/deploy -H 'content-type: application/json' -d @payload.json",
	},
};
