import type { Meta, StoryObj } from "@storybook/react-vite";
import { answer, type FakeApi, ScreenFrame } from "../../stories/screen-frame";
import { EventsScreen } from "./events-screen";

const meta = { title: "Screens/Event log", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const counts = { pending: 0, delivering: 0, delivered: 5, failed: 1, dead: 1, dismissed: 0 };
const item = (eventId: string, subscriber: string | null, state: string, kind = "published") => ({
	change: {
		eventId,
		kind,
		entryId: `entry-${eventId}`,
		collection: "post",
		occurredAt: "2026-10-01T09:30:00.000Z",
		workingSlug: `slug-${eventId}`,
		title: "첫 번째 글",
	},
	subscriber,
	state,
	attempts: 3,
	lastError: state === "failed" || state === "dead" ? "connect ECONNREFUSED 127.0.0.1:443" : null,
	nextAttemptAt: state === "failed" ? "2026-10-02T09:30:00.000Z" : null,
});
const list =
	(items: unknown[], c = counts): FakeApi =>
	(path) =>
		path.startsWith("/api/monti/v1/events") ? { items, total: items.length, counts: c } : undefined;

const screen = (api: FakeApi) => () => (
	<ScreenFrame api={api} title="이벤트 기록" nav="events">
		<EventsScreen />
	</ScreenFrame>
);

export const WithDeliveries: Story = {
	render: screen(
		list([
			item("e1", "search-index", "failed"),
			item("e2", "webhook", "dead", "deleted"),
			item("e3", "webhook", "delivered"),
		]),
	),
};
export const RecordedOnly: Story = {
	render: screen(list([item("e1", null, "recorded"), item("e2", null, "recorded", "updated")])),
};
export const Empty: Story = { render: screen(list([], { ...counts, failed: 0, dead: 0, delivered: 0 })) };
export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = { render: screen(() => answer(500)) };
