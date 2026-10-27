import type { Cms } from "@monti-cms/core/server";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { testSite } from "../../../core/test/site";
import { SetupProblemScreen } from "./setup-problem";

const meta = { title: "Screens/Setup problem", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotSetUp: Story = { render: () => <SetupProblemScreen cms={{ site: testSite } as Pick<Cms, "site">} /> };
