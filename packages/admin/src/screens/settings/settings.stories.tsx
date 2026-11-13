import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";
import { site } from "./collections.stories";

type Loaded = { site: StorySite };

/**
 * Settings › site, languages and admin (doc 12, flow 11). The collections tab's stories are in Screens/Settings/Collections; the four tabs share one
 * draft, so a story that changes one tab shows its dot on that tab from another.
 */
const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Settings/Tabs",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} streams={made.streams} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

/** How the site writes, as the reference screen has it. */
const WRITING =
	"‘~다’체로 쓴다. 한 문장은 짧게, 영어 낱말은 꼭 필요할 때만.\n코드 이름과 제품 이름은 옮기지 않고 그대로 둔다.";

type SiteOptions = NonNullable<Parameters<typeof site>[0]>;

/** The stories' site with a saved name and writing rules, opened at one settings tab. */
export const settingsAt = (tab: "site" | "languages" | "admin" | "collections", options: SiteOptions = {}) => [
	async () => {
		const [load] = site({
			...options,
			more: async (made) => {
				await made.monti.run("settings.save", { site: { name: "example.dev", writingStyle: WRITING } }, admin);
				await options.more?.(made);
			},
		});
		const loaded = await (load as () => Promise<Loaded>)();
		window.history.replaceState(null, "", `#/settings/${tab}`);
		return loaded;
	},
];

/** The live site: no way to the schema file, so structure values are locked. */
const live = { files: null } satisfies SiteOptions;

/** A dev server whose schema file cannot be written (a read-only checkout). */
const readOnlyFiles = {
	files: {
		write: async () => {
			throw new Error("EACCES: permission denied, open 'monti.schema.ts'");
		},
		readChanges: async () => [],
	},
} satisfies SiteOptions;

const screen = (canvasElement: HTMLElement) => ({
	page: within(canvasElement),
	body: within(canvasElement.ownerDocument.body),
});

/** The site tab as saved: the name, how the site writes, and how public addresses show the language. */
export const Site: Story = {
	loaders: settingsAt("site"),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByLabelText("사이트 이름", {}, wait);
	},
};

/** Flow 2, step 20: the name changed. Its label carries the dot and the undo, and the header the save group. */
export const SiteChanged: Story = {
	loaders: settingsAt("site"),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		const name = await page.findByLabelText("사이트 이름", {}, wait);
		await userEvent.clear(name);
		await userEvent.type(name, "example.blog");
		await page.findByRole("button", { name: "저장하고 적용" }, wait);
	},
};

/** Flow 11, step 15: the live site. The language mark of addresses is the schema file's, so it is text with a lock; the rest can be changed. */
export const SiteLive: Story = {
	loaders: settingsAt("site", live),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("img", { name: "운영 사이트에서는 잠김" }, wait);
	},
};

/** Flow 11, step 15b: the name changed on the live site. The pill says "저장". */
export const SiteLiveChanged: Story = {
	loaders: settingsAt("site", live),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		const name = await page.findByLabelText("사이트 이름", {}, wait);
		await userEvent.clear(name);
		await userEvent.type(name, "example.blog");
		await page.findByRole("button", { name: "저장" }, wait);
	},
};

/** Flow 2, step 21: the assistant proposed a name and another language mark for addresses, beside one change of the admin's. */
export const SiteProposal: Story = {
	loaders: settingsAt("site", {
		more: async ({ monti }) => {
			const proposal = await monti.proposals.create("conversation-1", "사이트 이름을 블로그답게");
			await monti.proposals.add(proposal, "settings.save", {
				site: { name: "example.blog" },
				locales: { ...schema.locales, prefix: "always" },
			});
		},
	}),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		const writing = await page.findByLabelText("말투와 규칙", {}, wait);
		await userEvent.type(writing, " 숫자는 아라비아 숫자로.");
		await page.findByRole("button", { name: "모두 받기" }, wait);
	},
};

/**
 * A save whose schema file could not be written (doc 12): the name is saved, the structure change stays in the draft, and the banner at the top of
 * the screen says why with the one thing to do.
 */
export const SaveRefused: Story = {
	loaders: settingsAt("site", readOnlyFiles),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		const name = await page.findByLabelText("사이트 이름", {}, wait);
		await userEvent.clear(name);
		await userEvent.type(name, "example.blog");
		await userEvent.click(page.getByRole("combobox", { name: "주소에 언어 표시" }));
		await userEvent.click(await body.findByRole("option", { name: "항상" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }, wait));
		await userEvent.click(await body.findByRole("button", { name: "적용" }, wait));
		await page.findByRole("button", { name: "다시 저장" }, wait);
	},
};

/** The language tab as saved: the source first, then the others with their handles and ×. */
export const Languages: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("button", { name: "+ 언어 추가" }, wait);
	},
};

/** Flow 11, step 05: "+ 언어 추가" open on "zh". */
export const LanguageSearch: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "+ 언어 추가" }, wait));
		await userEvent.type(await body.findByRole("combobox", {}, wait), "zh");
		await body.findByRole("option", { name: /zh-Hans/ }, wait);
	},
};

/** The search with nothing that matches. */
export const LanguageSearchEmpty: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "+ 언어 추가" }, wait));
		await userEvent.type(await body.findByRole("combobox", {}, wait), "klingon");
		await body.findByText("맞는 언어가 없습니다.", {}, wait);
	},
};

/** Picks a language in "+ 언어 추가". */
async function addLanguage(canvasElement: HTMLElement, query: string, option: RegExp) {
	const { page, body } = screen(canvasElement);
	await userEvent.click(await page.findByRole("button", { name: "+ 언어 추가" }, wait));
	await userEvent.type(await body.findByRole("combobox", {}, wait), query);
	await userEvent.click(await body.findByRole("option", { name: option }, wait));
	await waitFor(() => {
		if (body.queryByRole("option", { name: option })) throw new Error("the search is still open");
	}, wait);
}

/** Flow 11, step 06: a language picked. Its row is there at once with its dot, and the change joins the save group. */
export const LanguageAdded: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		await addLanguage(canvasElement, "de", /^Deutsch/);
		await screen(canvasElement).page.findByRole("button", { name: "Deutsch 빼기" }, wait);
	},
};

/** Flow 11, step 07: the source row's "바꾸기" menu, the source ticked. */
export const SourceMenu: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "바꾸기" }, wait));
		await body.findByRole("menuitemradio", { name: /English/ }, wait);
	},
};

/** Picks another source language in the "바꾸기" menu. */
async function changeSource(canvasElement: HTMLElement, name: RegExp) {
	const { page, body } = screen(canvasElement);
	await userEvent.click(await page.findByRole("button", { name: "바꾸기" }, wait));
	await userEvent.click(await body.findByRole("menuitemradio", { name }, wait));
	await page.findByRole("button", { name: "한국어 빼기" }, wait);
}

/** Flow 11, step 07b: English made the source. It stands first, and both rows carry the change dot. */
export const SourceChanged: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		await changeSource(canvasElement, /English/);
	},
};

/**
 * A language problem to fix: English was made the source, Korean taken out, and then the source change undone, so the source is a language that
 * is on its way out. The source row is struck and carries its undo in place of "바꾸기".
 */
export const LanguageProblem: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await changeSource(canvasElement, /English/);
		await userEvent.click(page.getByRole("button", { name: "한국어 빼기" }));
		await userEvent.click(await page.findByRole("button", { name: /변경 사항/ }, wait));
		const line = await body.findByRole("menuitem", { name: /원문 변경/ }, wait);
		await userEvent.click(within(line).getByRole("button", { name: "되돌리기" }));
		await userEvent.keyboard("{Escape}");
		await waitFor(() => {
			if (page.queryByRole("button", { name: "바꾸기" })) throw new Error("the source row still offers a change");
		}, wait);
	},
};

/** Saving with that problem: the review names it under "고칠 곳" with the way to the tab, and offers nothing to apply. */
export const LanguageProblemReview: Story = {
	loaders: settingsAt("languages"),
	play: async (context) => {
		await LanguageProblem.play?.(context);
		const { page, body } = screen(context.canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }, wait));
		await body.findByText("원문 언어가 목록에 없습니다", {}, wait);
	},
};

/** A language taken out: its row stays, struck, with its undo, until the save. */
export const LanguageRemoved: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "English 빼기" }, wait));
		await page.findByRole("button", { name: "되돌리기" }, wait);
	},
};

/** Flow 11, step 08: saving with a language taken out. The review has nothing to choose, only the red "지우고 적용". */
export const LanguageRemoveReview: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "English 빼기" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }, wait));
		await body.findByRole("button", { name: "지우고 적용" }, wait);
	},
};

/**
 * One review for the languages and the collections (doc 12, 2026-11-11): a language added, another made the source, the address mark changed and a
 * field added, all on one sheet with the plain "적용".
 */
export const OneReview: Story = {
	loaders: settingsAt("languages"),
	play: async ({ canvasElement }) => {
		const { page, body } = screen(canvasElement);
		await addLanguage(canvasElement, "de", /^Deutsch/);
		await changeSource(canvasElement, /English/);
		await userEvent.click(page.getByRole("link", { name: /사이트/ }));
		await userEvent.click(await page.findByRole("combobox", { name: "주소에 언어 표시" }, wait));
		await userEvent.click(await body.findByRole("option", { name: "항상" }, wait));
		await userEvent.click(page.getByRole("link", { name: /컬렉션/ }));
		await userEvent.click(await page.findByRole("button", { name: "+ 필드 추가" }, wait));
		await userEvent.click(await body.findByRole("option", { name: /^글자/ }, wait));
		await userEvent.type(await body.findByLabelText(/^식별자/, {}, wait), "kicker");
		await userEvent.click(body.getByRole("button", { name: "필드 추가" }));
		await page.findByRole("button", { name: "kicker 열기" }, wait);
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }, wait));
		await body.findByRole("button", { name: "적용" }, wait);
	},
};

/** Flow 11, step 16: the live site. Every row carries a lock; nothing moves, goes or is added. */
export const LanguagesLive: Story = {
	loaders: settingsAt("languages", live),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		await waitFor(() => {
			if (page.queryAllByRole("img", { name: "운영 사이트에서는 잠김" }).length < 3) throw new Error("no locks yet");
		}, wait);
	},
};

/** The assistant proposed a language: its row is there in blue until it is taken or discarded, and the bubble walks to it. */
export const LanguageProposal: Story = {
	loaders: settingsAt("languages", {
		more: async ({ monti }) => {
			const proposal = await monti.proposals.create("conversation-1", "독일어도 추가해 줘");
			await monti.proposals.add(proposal, "locales.apply", {
				locales: { ...schema.locales, list: [...schema.locales.list, { code: "de", name: "Deutsch" }] },
				answers: {},
			});
		},
	}),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("button", { name: "모두 받기" }, wait);
	},
};

/**
 * The assistant proposed a collection's admin values (its name) and nothing of its structure: the collections tab carries the blue dot, the name
 * is blue on the collection's basics with the saved one struck under it, and the bubble takes it.
 */
export const CollectionValuesProposal: Story = {
	loaders: settingsAt("collections", {
		more: async ({ monti }) => {
			// The assistant names the label alone: a patch, so nothing else of the collection is proposed (doc 12).
			const proposal = await monti.proposals.create("conversation-1", "게시글을 글이라고 불러 줘");
			await monti.proposals.add(proposal, "collections.updateAdminValues", {
				collection: "post",
				values: { label: "글" },
			});
		},
	}),
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		await page.findByRole("button", { name: "모두 받기" }, wait);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await page.findByLabelText("표시 이름", {}, wait);
	},
};

/** The admin tab: the screen's language, the feature switch and the signed-in account. */
export const Admin: Story = {
	loaders: settingsAt("admin"),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("button", { name: "로그아웃" }, wait);
	},
};

/** A preference that could not be saved: the reason stays under its control, and the control shows what is still saved. */
export const AdminRefused: Story = {
	loaders: settingsAt("admin"),
	render: (_args, { loaded }) => {
		const { transport } = (loaded as Loaded).site;
		return (
			<MontiAdmin
				transport={(name, input, options) =>
					name === "admin.setPreference"
						? Promise.resolve({ status: 500, body: { error: "unexpected" } })
						: transport(name, input, options)
				}
				siteName="example.dev"
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const { page } = screen(canvasElement);
		await userEvent.click(await page.findByRole("switch", { name: "본문 템플릿" }, wait));
		await page.findByText("저장하지 못했습니다", {}, wait);
	},
};

/** The dev server let this machine in without signing in (doc 16): there is no account, so the account section is not drawn. */
export const AdminDevBypass: Story = {
	loaders: settingsAt("admin"),
	render: (_args, { loaded }) => {
		const { transport } = (loaded as Loaded).site;
		return (
			<MontiAdmin
				transport={async (name, input, options) => {
					const answer = await transport(name, input, options);
					if (name !== "auth.state") return answer;
					return { ...answer, body: { ...(answer.body as object), session: { who: "dev", bypass: true } } };
				}}
				siteName="example.dev"
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("switch", { name: "본문 템플릿" }, wait);
	},
};

/** The screen's language set to English: every word of the admin follows at once. */
export const AdminEnglish: Story = {
	loaders: settingsAt("admin", {
		more: async ({ monti }) => {
			await monti.run("admin.setPreference", { language: "en" }, admin);
		},
	}),
	play: async ({ canvasElement }) => {
		await screen(canvasElement).page.findByRole("button", { name: "Sign out" }, wait);
	},
};
