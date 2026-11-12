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

/** Opens a column's menu by its name, as a press on the name does. */
function openColumn(canvas: HTMLElement, name: string) {
	const head = [...canvas.querySelectorAll<HTMLElement>("thead button")].find(
		(button) => button.textContent?.trim() === name,
	);
	head?.click();
}

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
/** The activity log as it opens: a screen of its own, the log as the lists' table, one failed delivery in its row's delivery cell and in the banner at the top (flow 12·01). */
export const Events: Story = { render: () => <EventsScreen /> };
/** The menu of "what was done": the kinds to filter by, each with its count (12·09). */
export const EventsWhatMenu: Story = {
	render: () => <EventsScreen stage="whatMenu" />,
	play: async ({ canvasElement }) => openColumn(canvasElement, "한 일"),
};
/** The delivery column's menu: the states to filter by (12·09). */
export const EventsDeliveryMenu: Story = {
	render: () => <EventsScreen stage="deliveryMenu" />,
	play: async ({ canvasElement }) => openColumn(canvasElement, "전송"),
};
/** A row's ⋯: what can be done with the line. */
export const EventsRowMenu: Story = { render: () => <EventsScreen stage="rowMenu" /> };
/** Filtered to failed deliveries: a dot after the column's name, and the failed rows alone (12·01b). */
export const EventsFailedOnly: Story = { render: () => <EventsScreen stage="failedOnly" /> };
/** A row's delivery is being sent again: its cell says so (12·02). */
export const EventsRetrying: Story = { render: () => <EventsScreen stage="retrying" /> };
/** It arrived: nothing is failed, the filtered list has no row, and a toast says it was sent (12·02b). */
export const EventsRetried: Story = { render: () => <EventsScreen stage="retried" /> };
/** A row is open beside the list: when and who, the entry, and each receiver's delivery (12·03). */
export const EventsDetail: Story = { render: () => <EventsScreen stage="detail" /> };
/** The assistant's row open beside the list: the request whole, and everything it did and touched. */
export const EventsDetailAssistant: Story = { render: () => <EventsScreen stage="detailAssistant" /> };
/** A row whose entry has been deleted for good since: its name stays, with nothing to open. */
export const EventsDetailGone: Story = { render: () => <EventsScreen stage="detailGone" /> };
/** Canceling a delivery asks first: it cannot be taken back (12·04). */
export const EventsCancelConfirm: Story = { render: () => <EventsScreen stage="cancelConfirm" /> };
/** Canceled: the row and the panel say so, and it no longer counts as failed (12·04b). */
export const EventsCanceled: Story = { render: () => <EventsScreen stage="canceled" /> };
/** Three failed deliveries: a banner at the top of the page offers to send them all (12·05). */
export const EventsThreeFailed: Story = { render: () => <EventsScreen stage="threeFailed" /> };
/** One publish neither receiver got: its row says how many deliveries failed, and the banner and the sidebar count deliveries (three). */
export const EventsTwoOnOneRow: Story = { render: () => <EventsScreen stage="twoOnOneRow" /> };
/** All of them are being sent again: the banner and the rows say so (12·06). */
export const EventsRetryingAll: Story = { render: () => <EventsScreen stage="retryingAll" /> };
/** All arrived: no banner, no counts, and a toast with how many (12·07). */
export const EventsAllSent: Story = { render: () => <EventsScreen stage="allSent" /> };
/** One failed again: its row is left, and the banner counts that one (12·08). */
export const EventsSomeFailed: Story = { render: () => <EventsScreen stage="someFailed" /> };
/** Searched for an entry's name: everything done to one entry, the assistant's work marked ✦ (flow 2·18). */
export const EventsSearched: Story = { render: () => <EventsScreen stage="searched" /> };
/** A site with no receiver: the log with no delivery column (12·10). */
export const EventsNoReceivers: Story = { render: () => <EventsScreen stage="noReceivers" /> };
/** Nothing logged yet (12·11). */
export const EventsEmpty: Story = { render: () => <EventsScreen stage="empty" /> };
/** More rows than a page holds: the range and the pages under the table. */
export const EventsPages: Story = { render: () => <EventsScreen stage="pages" /> };
/** The log could not be read: a banner at the top of the page. */
export const EventsLoadFailed: Story = { render: () => <EventsScreen stage="loadFailed" /> };
export const Data: Story = { render: () => <DataScreen /> };
export const Sidebar: Story = { render: () => <SidebarScreen /> };
export const SidebarRail: Story = { render: () => <SidebarRailScreen /> };
export const SidebarTheme: Story = { render: () => <SidebarThemeScreen /> };
export const SidebarThemeRail: Story = { render: () => <SidebarThemeRailScreen /> };
