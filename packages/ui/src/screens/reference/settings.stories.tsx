import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminSettingsScreen } from "./admin-settings";
import { ApiKeysScreen } from "./api-keys";
import { LocalesScreen } from "./locales";
import { SchemaScreen } from "./schema";
import { SchemaAddFieldScreen } from "./schema-add-field";
import { SchemaReviewScreen } from "./schema-review";
import { SettingsScreen } from "./settings";
import { SettingsProposalScreen } from "./settings-proposal";

/** The settings screens as the design reference, drawn only with design-system parts. */
const meta = {
	title: "Screens/Reference/Settings",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = { render: () => <SettingsScreen /> };
export const SettingsProposal: Story = { render: () => <SettingsProposalScreen /> };
export const AdminSettings: Story = { render: () => <AdminSettingsScreen /> };
export const ApiKeys: Story = { render: () => <ApiKeysScreen /> };
export const Locales: Story = { render: () => <LocalesScreen /> };
export const Schema: Story = { render: () => <SchemaScreen /> };
export const SchemaAddField: Story = { render: () => <SchemaAddFieldScreen /> };
export const SchemaReview: Story = { render: () => <SchemaReviewScreen /> };
