import type { Meta, StoryObj } from "@storybook/react-vite";
import { ko } from "react-day-picker/locale";
import { Calendar } from "./calendar";
import { Stack } from "./stack";

const meta = {
	title: "Field/Calendar",
	component: Calendar,
	args: { locale: ko, defaultMonth: new Date(2026, 9, 1) },
} satisfies Meta<typeof Calendar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	args: { mode: "single", selected: new Date(2026, 9, 22) },
};

export const Range: Story = {
	args: {
		mode: "range",
		selected: { from: new Date(2026, 9, 12), to: new Date(2026, 9, 18) },
	},
};

export const Multiple: Story = {
	args: {
		mode: "multiple",
		selected: [new Date(2026, 9, 3), new Date(2026, 9, 14), new Date(2026, 9, 28)],
	},
};

export const Disabled: Story = {
	args: {
		mode: "single",
		selected: new Date(2026, 9, 22),
		disabled: [{ before: new Date(2026, 9, 10) }, { dayOfWeek: [0] }],
	},
};

export const Layouts: Story = {
	render: () => (
		<Stack gap={24}>
			<Calendar
				locale={ko}
				defaultMonth={new Date(2026, 9, 1)}
				mode="single"
				captionLayout="dropdown"
				startMonth={new Date(2020, 0)}
				endMonth={new Date(2030, 11)}
			/>
			<Calendar locale={ko} defaultMonth={new Date(2026, 9, 1)} mode="single" showOutsideDays={false} />
			<Calendar locale={ko} defaultMonth={new Date(2026, 9, 1)} mode="single" numberOfMonths={2} />
			<Calendar locale={ko} defaultMonth={new Date(2026, 9, 1)} mode="single" showWeekNumber />
		</Stack>
	),
};
