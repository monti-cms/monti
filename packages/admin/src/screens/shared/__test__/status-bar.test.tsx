import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import {
	StatusBar,
	type StatusBarContextValue,
	StatusBarItem,
	type StatusItems,
	StatusItemsProvider,
	useStatusBarContext,
} from "../status-bar";

const { render: renderWithRouter } = createTestRouter();

let failed = 0;
beforeEach(() => {
	failed = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string) => {
			if (input.startsWith("/api/monti/v1/events"))
				return jsonResponse({ items: [], total: 0, counts: { failed, dead: 0 } });
			throw new Error(`Unexpected fetch: ${input}`);
		}),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const show = (context: StatusBarContextValue, items: StatusItems = {}) =>
	renderWithRouter(
		withSite(
			<StatusItemsProvider items={items}>
				<StatusBar context={context} />
			</StatusItemsProvider>,
		),
	);
const bar = () => within(screen.getByRole("region", { name: "상태" }));
const texts = (element: HTMLElement) => [...element.querySelectorAll("span.truncate")].map((node) => node.textContent);

describe("status bar", () => {
	it("draws a plugin's item in its group, ordered by `order`", () => {
		const Item = ({ label }: { label: string }) => <StatusBarItem title={label}>{label}</StatusBarItem>;
		show(
			{ screen: "tools" },
			{
				late: { align: "start", order: 200, Component: () => <Item label="늦은 항목" /> },
				early: { align: "start", order: 5, Component: () => <Item label="이른 항목" /> },
				right: { align: "end", order: 1, Component: () => <Item label="오른쪽 항목" /> },
			},
		);
		const [start, end] = (screen.getByRole("region", { name: "상태" }).children ?? []) as unknown as HTMLElement[];
		expect(texts(start as HTMLElement)).toEqual(["이른 항목", "늦은 항목"]);
		expect(texts(end as HTMLElement)).toEqual(["오른쪽 항목"]);
	});

	it("leaves no gap or wrapper for an item that renders nothing", () => {
		show(
			{ screen: "tools" },
			{
				a: { align: "start", order: 1, Component: () => <StatusBarItem title="가">가</StatusBarItem> },
				hidden: { align: "start", order: 2, Component: () => null },
			},
		);
		const [start] = screen.getByRole("region", { name: "상태" }).children as unknown as HTMLElement[];
		expect((start as HTMLElement).children).toHaveLength(1);
	});

	it("gives an item the screen it is on", () => {
		const Where = () => {
			const { screen: kind, collection } = useStatusBarContext();
			return <StatusBarItem title="위치">{`${kind}:${collection}`}</StatusBarItem>;
		};
		show({ screen: "list", collection: "post" }, { where: { align: "end", order: 1, Component: Where } });
		expect(bar().getByText("list:post")).toBeTruthy();
	});

	it("renders a link, a button or plain text by what the item leads to", () => {
		show(
			{ screen: "tools" },
			{
				link: {
					align: "start",
					order: 1,
					Component: () => (
						<StatusBarItem title="링크" href="/admin/x">
							링크
						</StatusBarItem>
					),
				},
				button: {
					align: "start",
					order: 2,
					Component: () => (
						<StatusBarItem title="버튼" onClick={() => {}}>
							버튼
						</StatusBarItem>
					),
				},
				plain: { align: "start", order: 3, Component: () => <StatusBarItem title="글">글</StatusBarItem> },
			},
		);
		expect(bar().getByRole("link", { name: "링크" })).toBeTruthy();
		expect(bar().getByRole("button", { name: "버튼" })).toBeTruthy();
		expect(bar().queryByRole("link", { name: "글" })).toBeNull();
		expect(bar().queryByRole("button", { name: "글" })).toBeNull();
	});

	it("shows failed deliveries only when there are some, linking to the event log", async () => {
		failed = 2;
		show({ screen: "tools" });
		const link = await bar().findByRole("link", { name: /웹훅 2건 실패/ });
		expect(link.getAttribute("href")).toMatch(/\/events$/);
	});

	it("shows no failed-delivery item when none failed", async () => {
		show({ screen: "tools" });
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(bar().queryByText(/실패/)).toBeNull();
	});

	it("shows the entry count of a list on the right, and nothing on screens without one", () => {
		show({ screen: "list", collection: "post", count: 8 });
		expect(bar().getByText("8개")).toBeTruthy();
		cleanup();
		show({ screen: "tools" });
		expect(bar().queryByText(/개$/)).toBeNull();
	});
});
