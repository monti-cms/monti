import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
import { Option } from "./option";
import { Switch } from "./switch";

/** A row of a choice: a control, its text and, if needed, a note. Pressing the text presses the control. */
const meta = { title: "Controls/Choice/Option", component: Option } satisfies Meta<typeof Option>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCheckbox: Story = {
	render: () => (
		<Option>
			<Checkbox defaultChecked />
			글자 굵게
		</Option>
	),
};

/** `spread` pushes the control to the far end, the way a switch row reads. */
export const SpreadSwitch: Story = {
	render: () => (
		<div className="w-80">
			<Option spread>
				경로에 언어 넣기
				<Switch defaultChecked />
			</Option>
		</div>
	),
};

export const Disabled: Story = {
	render: () => (
		<Option>
			<Checkbox disabled />
			글자 굵게
		</Option>
	),
};
