import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, ScreenFrame } from "../../../admin/src/stories/screen-frame";
import type { AiActionView } from "../actions";
import type { AiProviderView, AiSettingsView } from "../connection";
import type { AiSnippetView } from "../snippets";
import { AiManager } from "./ai-manager";

const meta = { title: "Screens/AI/AI screen", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// --- Fixtures ---

const editable = (label: string, prompt: string, checks: AiActionView["checks"] = []) => ({
	enabled: true,
	hidden: false,
	label,
	askInstruction: false,
	instant: false,
	providerId: null,
	modelName: "",
	prompt,
	send: ["title"],
	threshold: 0.6,
	maxCount: 5,
	checks,
});

/** A feature whose values equal its defaults, unless `over` says otherwise. */
const feature = (key: string, label: string, over: Partial<AiActionView> = {}): AiActionView => {
	const base = editable(label, "제목에 어울리는 값을 만들어 주세요.");
	return {
		key,
		result: "candidates",
		apply: "replace",
		engine: "generate",
		pick: "one",
		input: { title: { kind: "text", label: "제목", required: false } },
		attach: [{ slot: "field", field: key, collections: ["post"] }],
		definedChecks: [],
		validatorLabels: {},
		stream: false,
		defaults: base,
		version: 1,
		updatedAt: null,
		overridden: [],
		...base,
		...over,
	};
};

const features: AiActionView[] = [
	feature("slug", "슬러그 제안"),
	feature("summary", "요약 쓰기", { result: "text" }),
	feature("category", "분류 고르기", {
		// Edited values differ from the defaults, so the Advanced section opens by itself.
		checks: [
			{ kind: "maxLength", enabled: true, max: 40 },
			{ kind: "oneOf", enabled: true, items: ["뉴스", "리뷰", "칼럼", "인터뷰"] },
		],
		definedChecks: ["maxLength"],
		updatedAt: "2026-10-10T09:00:00.000Z",
		version: 2,
	}),
];

const provider = (over: Partial<AiProviderView> = {}): AiProviderView => ({
	id: "p1",
	name: "OpenRouter",
	kind: "chat",
	url: "https://openrouter.ai/api/v1",
	key: { id: "k1", name: "OpenRouter", tail: "91c0", readable: true },
	defaultModel: "google/gemini-2.5-flash",
	ready: true,
	toolSupport: {},
	...over,
});
const settings = (providers: AiProviderView[]): AiSettingsView => ({
	version: 1,
	providers,
	agent: { setting: null, effective: null },
	fake: false,
});
const connected = settings([provider(), provider({ id: "p2", name: "새 서비스", key: null, ready: false })]);
const snippets: AiSnippetView = {
	version: 1,
	items: [
		{
			source: "config",
			key: "style",
			label: "문체 가이드",
			text: "존댓말을 쓰고, 문장은 짧게 써요.",
			defaultText: "존댓말을 쓰고, 문장은 짧게 써요.",
			overridden: false,
		},
		{ source: "added", key: "brand", label: "브랜드 소개", text: "우리는 작은 책방이에요." },
	],
};

type Data = {
	actions?: { usable: string[]; items: AiActionView[] };
	settings?: AiSettingsView;
	snippets?: AiSnippetView;
	/** Answers for the writes and runs: the run, the connection check, the save. */
	onWrite?: FakeApi;
};
const ai =
	(data: Data = {}): FakeApi =>
	(path, method) => {
		const { actions, settings: s, snippets: sn, onWrite } = data;
		if (path === "/api/monti/v1/ai/actions" && method === "GET") return actions ?? { usable: [], items: [] };
		if (path === "/api/monti/v1/ai/settings" && method === "GET") return s ?? settings([]);
		if (path === "/api/monti/v1/ai/snippets" && method === "GET") return sn ?? { version: 1, items: [] };
		if (path === "/api/monti/v1/api-keys" && method === "GET")
			return {
				items: [{ id: "k1", name: "OpenRouter", tail: "91c0", readable: true, version: 1, uses: [], slots: [] }],
				secretsAvailable: true,
				slots: [],
			};
		if (path === "/api/monti/v1/ai/models")
			return { items: [{ id: "google/gemini-2.5-flash" }, { id: "openai/gpt-4o" }] };
		return onWrite?.(path, method);
	};
const withConnection = (over: Data = {}) =>
	ai({ actions: { usable: ["slug", "summary", "category"], items: features }, settings: connected, snippets, ...over });

const screen = (fake: FakeApi) => () => (
	<ScreenFrame api={fake} title="AI" nav="ai" pathname="/admin/ai">
		<AiManager />
	</ScreenFrame>
);

// --- Play helpers ---

const tab = async (canvasElement: HTMLElement, name: string) =>
	userEvent.click(await within(canvasElement).findByRole("tab", { name }));
const row = async (canvasElement: HTMLElement, name: RegExp) =>
	userEvent.click(await within(canvasElement).findByRole("button", { name }));
const runTest = async (canvasElement: HTMLElement) => {
	await userEvent.click(await within(canvasElement).findByRole("button", { name: "테스트해 보기" }));
};

// --- Features tab ---

export const FeaturesNoConnection: Story = {
	render: screen(ai({ actions: { usable: [], items: features }, settings: settings([]) })),
};
export const FeaturesLoaded: Story = { render: screen(withConnection()) };
export const FeaturesEmpty: Story = {
	render: screen(ai({ actions: { usable: [], items: [] }, settings: settings([]) })),
};
export const FeaturesLoading: Story = { render: screen(() => "pending") };
export const FeaturesLoadFailed: Story = { render: screen(() => answer(500)) };
export const FeatureOpen: Story = {
	render: screen(withConnection()),
	play: ({ canvasElement }) => row(canvasElement, /슬러그 제안/),
};
/** The category feature, with its checks open: the one-of check holds its allowed values as tags. */
export const FeatureChecks: Story = {
	render: screen(withConnection()),
	play: async ({ canvasElement }) => {
		await row(canvasElement, /분류 고르기/);
		await within(canvasElement)
			.findByRole("textbox", { name: "값 입력 후 Enter" })
			.catch(() => undefined);
	},
};
export const FeatureTestResult: Story = {
	render: screen(
		withConnection({
			onWrite: (path) =>
				path === "/api/monti/v1/ai/run"
					? {
							result: {
								kind: "candidates",
								items: [
									{ value: "first-post", label: "first-post", detail: "92%" },
									{ value: "hello-world", label: "hello-world", detail: "81%" },
								],
							},
						}
					: undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await row(canvasElement, /슬러그 제안/);
		await runTest(canvasElement);
		await within(canvasElement).findByText("first-post");
	},
};
export const FeatureTestFailed: Story = {
	render: screen(
		withConnection({
			onWrite: (path) =>
				path === "/api/monti/v1/ai/run"
					? answer(502, { error: { code: "upstream_failed", message: "AI 서비스가 응답하지 않아요." } })
					: undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await row(canvasElement, /슬러그 제안/);
		await runTest(canvasElement);
		await within(canvasElement).findByText(/AI 서비스가 응답하지 않아요/);
	},
};
export const FeatureSaveFailed: Story = {
	render: screen(
		withConnection({
			onWrite: (path, method) =>
				method === "PATCH" && path.startsWith("/api/monti/v1/ai/actions/")
					? answer(409, { error: { code: "conflict", message: "다른 곳에서 먼저 바뀌었어요." } })
					: undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await row(canvasElement, /슬러그 제안/);
		const c = within(canvasElement);
		await userEvent.click(await c.findByTestId("ai-advanced-toggle"));
		const prompt = await c.findByRole("textbox", { name: "지시문" });
		await userEvent.type(prompt, " 짧게 써 주세요.");
		await userEvent.click(await c.findByRole("button", { name: "저장" }));
		await waitFor(() => expect(c.getByText("다른 곳에서 먼저 바뀌었어요.")).toBeInTheDocument());
	},
};
export const NewFeature: Story = {
	render: screen(withConnection()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "기능 추가" }));
		await within(canvasElement).findByRole("region", { name: "기본 정보" });
	},
};

// --- Connections tab ---

export const ConnectionsLoaded: Story = {
	render: screen(withConnection()),
	play: ({ canvasElement }) => tab(canvasElement, "연결"),
};
export const ConnectionsEmpty: Story = {
	render: screen(ai({ actions: { usable: [], items: features }, settings: settings([]) })),
	play: ({ canvasElement }) => tab(canvasElement, "연결"),
};
export const ConnectionsLoadFailed: Story = {
	render: screen((path, method) =>
		path === "/api/monti/v1/ai/settings" && method === "GET"
			? answer(500)
			: ai({ actions: { usable: [], items: features } })(path, method),
	),
	play: ({ canvasElement }) => tab(canvasElement, "연결"),
};
export const ConnectionEditorExisting: Story = {
	render: screen(withConnection()),
	play: async ({ canvasElement }) => {
		await tab(canvasElement, "연결");
		await row(canvasElement, /OpenRouter/);
	},
};
export const ConnectionEditorNew: Story = {
	render: screen(withConnection()),
	play: async ({ canvasElement }) => {
		await tab(canvasElement, "연결");
		// The title bar and the empty list both offer it; either opens the editor.
		const [add] = await within(canvasElement).findAllByRole("button", { name: "연결 추가" });
		if (add) await userEvent.click(add);
		await within(canvasElement).findByRole("textbox", { name: "이름" });
	},
};
export const ConnectionCheckFailed: Story = {
	render: screen(
		withConnection({
			onWrite: (path) =>
				path === "/api/monti/v1/ai/providers/check"
					? { ok: false, message: "키가 맞지 않아요. 서비스가 401을 돌려줬어요." }
					: undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await tab(canvasElement, "연결");
		await row(canvasElement, /OpenRouter/);
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "연결 확인" }));
		await within(canvasElement).findByText(/401/);
	},
};

// --- Prompt snippets tab ---

export const SnippetsLoaded: Story = {
	render: screen(withConnection()),
	play: ({ canvasElement }) => tab(canvasElement, "공용 문구"),
};
export const SnippetOpen: Story = {
	render: screen(withConnection()),
	play: async ({ canvasElement }) => {
		await tab(canvasElement, "공용 문구");
		await row(canvasElement, /브랜드 소개/);
	},
};
export const SnippetsEmpty: Story = {
	render: screen(withConnection({ snippets: { version: 1, items: [] } })),
	play: ({ canvasElement }) => tab(canvasElement, "공용 문구"),
};
export const SnippetsLoadFailed: Story = {
	render: screen((path, method) =>
		path === "/api/monti/v1/ai/snippets" && method === "GET" ? answer(500) : withConnection()(path, method),
	),
	play: ({ canvasElement }) => tab(canvasElement, "공용 문구"),
};
