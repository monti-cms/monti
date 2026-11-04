import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataScreen } from "./data";
import { EmptyScreen } from "./empty";
import { EventsScreen } from "./events";
import { MainScreen } from "./main";
import { MediaScreen } from "./media";
import { SidebarRailScreen, SidebarScreen, SidebarThemeRailScreen, SidebarThemeScreen } from "./sidebar";
import { TaxonomyScreen } from "./taxonomy";
import { TemplatesScreen } from "./templates";
import { TrashScreen } from "./trash";

/** The list screens and the frame alone, made of design-system parts only: the reference for building them. */
const meta = {
	title: "Screens/Reference/Lists",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Main: Story = { render: () => <MainScreen /> };
export const Media: Story = { render: () => <MediaScreen /> };
export const Trash: Story = { render: () => <TrashScreen /> };
export const Templates: Story = { render: () => <TemplatesScreen /> };
export const Taxonomy: Story = { render: () => <TaxonomyScreen /> };
export const Empty: Story = { render: () => <EmptyScreen /> };
export const Events: Story = { render: () => <EventsScreen /> };
export const Data: Story = { render: () => <DataScreen /> };
export const Sidebar: Story = { render: () => <SidebarScreen /> };
export const SidebarRail: Story = { render: () => <SidebarRailScreen /> };
export const SidebarTheme: Story = { render: () => <SidebarThemeScreen /> };
export const SidebarThemeRail: Story = { render: () => <SidebarThemeRailScreen /> };
