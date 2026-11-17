import type { Meta, StoryObj } from "@storybook/react-vite";
import { Save } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./index";

/** The name of an icon button: a small black pill, one or two words, with its keys after it in mono when it has them. */
/** A bare trigger as high as a small icon button, so the story shows the tooltip part alone. */
const TRIGGER =
	"inline-flex size-monti-control-xs items-center justify-center rounded-monti-full border-0 bg-transparent p-0";

const meta = {
	title: "Controls/Overlay/Tooltip",
	component: Tooltip,
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A name only. `IconButton` draws this from its `label`. */
export const Name: Story = {
	render: () => (
		<Tooltip defaultOpen>
			<TooltipTrigger render={<button type="button" aria-label="저장" className={TRIGGER} />}>
				<Save />
			</TooltipTrigger>
			<TooltipContent>저장</TooltipContent>
		</Tooltip>
	),
};

/** With the keys that do the same: "⌘S" on a Mac, "Ctrl+S" elsewhere. */
export const Shortcut: Story = {
	render: () => (
		<Tooltip defaultOpen>
			<TooltipTrigger render={<button type="button" aria-label="저장" className={TRIGGER} />}>
				<Save />
			</TooltipTrigger>
			<TooltipContent shortcut={["mod", "S"]}>저장</TooltipContent>
		</Tooltip>
	),
};
