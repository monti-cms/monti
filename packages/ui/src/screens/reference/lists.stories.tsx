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
/** A row right-clicked over its title: the row menu opens at the cursor. */
export const MainRowMenu: Story = {
	render: () => <MainScreen rowMenu />,
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>("[data-row-menu]");
		if (!row) return;
		const box = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: box.left + 320,
				clientY: box.top + box.height / 2,
			}),
		);
	},
};
export const Media: Story = { render: () => <MediaScreen /> };
export const Trash: Story = { render: () => <TrashScreen /> };
export const Templates: Story = { render: () => <TemplatesScreen /> };
export const Taxonomy: Story = { render: () => <TaxonomyScreen /> };
export const Empty: Story = { render: () => <EmptyScreen /> };
/** The activity tab as it opens: one failed delivery, in its own line, with no banner over the log (flow 12·01). */
export const Events: Story = { render: () => <EventsScreen /> };
/** The failed filter is on: its chip, and the failed lines alone (12·01b). */
export const EventsFailedOnly: Story = { render: () => <EventsScreen stage="failedOnly" /> };
/** A line's delivery is being sent again: its button says so and cannot be pressed (12·02). */
export const EventsRetrying: Story = { render: () => <EventsScreen stage="retrying" /> };
/** It arrived: the filtered log is empty, the counts are gone, and a toast says it was sent (12·02b). */
export const EventsRetried: Story = { render: () => <EventsScreen stage="retried" /> };
/** A line is open beside the log: the event, the entry, and each receiver's delivery (12·03). */
export const EventsDetail: Story = { render: () => <EventsScreen stage="detail" /> };
/** The assistant's line open beside the log: who, and everything the request touched. */
export const EventsDetailAssistant: Story = { render: () => <EventsScreen stage="detailAssistant" /> };
/** A line whose entry has been deleted for good since: its name stays, with nothing to open. */
export const EventsDetailGone: Story = { render: () => <EventsScreen stage="detailGone" /> };
/** Canceling a delivery asks first: it cannot be taken back (12·04). */
export const EventsCancelConfirm: Story = { render: () => <EventsScreen stage="cancelConfirm" /> };
/** Canceled: the line and the panel say so, and it no longer counts as failed (12·04b). */
export const EventsCanceled: Story = { render: () => <EventsScreen stage="canceled" /> };
/** Three failed deliveries: a banner over the log offers to send them all (12·05). */
export const EventsThreeFailed: Story = { render: () => <EventsScreen stage="threeFailed" /> };
/** All of them are being sent again: the banner and the failed lines say so (12·06). */
export const EventsRetryingAll: Story = { render: () => <EventsScreen stage="retryingAll" /> };
/** All arrived: no banner, no counts, and a toast with how many (12·07). */
export const EventsAllSent: Story = { render: () => <EventsScreen stage="allSent" /> };
/** One failed again: its line is left, alone, so there is no banner (12·08). */
export const EventsSomeFailed: Story = { render: () => <EventsScreen stage="someFailed" /> };
/** The filter's menu with the delivery states open beside it (12·09). */
export const EventsFilterMenu: Story = { render: () => <EventsScreen stage="filterMenu" /> };
/** The pending filter: deliveries on their way (12·09b). */
export const EventsFilteredPending: Story = { render: () => <EventsScreen stage="filteredPending" /> };
/** One entry's lines of the assistant's, as the editor's "what the assistant changed" opens the log (flow 2·18). */
export const EventsOneEntry: Story = { render: () => <EventsScreen stage="oneEntry" /> };
/** Filters with nothing under them. */
export const EventsNoMatch: Story = { render: () => <EventsScreen stage="noMatch" /> };
/** A site with no receiver: the log alone, with nothing about deliveries (12·10). */
export const EventsNoReceivers: Story = { render: () => <EventsScreen stage="noReceivers" /> };
/** Nothing logged yet (12·11). */
export const EventsEmpty: Story = { render: () => <EventsScreen stage="empty" /> };
/** More lines than a page holds: the range and the pages under the log. */
export const EventsPages: Story = { render: () => <EventsScreen stage="pages" /> };
/** The log could not be read. */
export const EventsLoadFailed: Story = { render: () => <EventsScreen stage="loadFailed" /> };
export const Data: Story = { render: () => <DataScreen /> };
export const Sidebar: Story = { render: () => <SidebarScreen /> };
export const SidebarRail: Story = { render: () => <SidebarRailScreen /> };
export const SidebarTheme: Story = { render: () => <SidebarThemeScreen /> };
export const SidebarThemeRail: Story = { render: () => <SidebarThemeRailScreen /> };
