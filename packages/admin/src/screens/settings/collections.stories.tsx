import { assistant, scriptedProvider } from "@monti-cms/ai";
import { defineSchema, type MontiOptions } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sql } from "kysely";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Monti = StorySite["monti"];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Settings/Collections",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} streams={made.streams} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

/** The posts' admin values the reference screens show: a Korean name, the field labels and help. */
const postValues = {
	label: "게시글",
	folders: true,
	fields: {
		title: { label: "제목" },
		slug: { label: "주소" },
		summary: { label: "요약", description: "목록과 검색 결과에 나오는 한 문장. 결론을 먼저." },
		subtitle: { label: "부제" },
		cover: { label: "대표 이미지", description: "대체 텍스트는 보이는 것만, 80자 안." },
		category: { label: "카테고리" },
	},
};

/** The admin values the reference screens show: Korean names, the posts' field labels and help. */
async function setup(monti: Monti) {
	await monti.run("collections.updateAdminValues", { collection: "post", values: postValues }, admin);
	await monti.run("collections.updateAdminValues", { collection: "memo", values: { label: "메모" } }, admin);
	await monti.run("collections.updateAdminValues", { collection: "category", values: { label: "카테고리" } }, admin);
	for (const [title, summary] of [
		["첫 번째 글", "한 문장 요약"],
		["발행 후 고친 글", "두 번째 요약"],
		["요약 없는 글", ""],
	])
		await monti.run(
			"entries.create",
			{ collection: "post", locale: "ko", title, values: { summary, subtitle: "부제" } },
			admin,
		);
}

/** The dev server: it has the schema files (a story writes none), so structure can change. */
const devFiles = { write: async () => {}, readChanges: async () => [] };

const relationFieldSchema = defineSchema({
	...schema,
	collections: {
		...schema.collections,
		post: {
			...schema.collections.post,
			fields: {
				...schema.collections.post.fields,
				relatedBy: { kind: "relation", to: "post", many: true },
			},
		},
	},
});

/** The posts with a choice ("분위기") and a conditional field ("글 종류", required), for what the review says of their options (docs 12 and 19). */
export const optionsSchema = defineSchema({
	...schema,
	collections: {
		...schema.collections,
		post: {
			...schema.collections.post,
			fields: {
				...schema.collections.post.fields,
				mood: { kind: "select", options: ["calm", "loud"] },
				format: {
					kind: "conditional",
					required: true,
					options: ["article", "video", "link"],
					fields: {
						video: { videoUrl: { kind: "text", required: true } },
						link: { linkUrl: { kind: "text", required: true } },
					},
				},
			},
		},
	},
});

/** Three posts on those options: a loud video post on the site, a loud draft, and a calm article on the site. */
export async function optionEntries({ monti }: StorySite) {
	await monti.run(
		"collections.updateAdminValues",
		{
			collection: "post",
			values: {
				fields: {
					mood: { label: "분위기", optionLabels: { calm: "차분", loud: "시끌" } },
					format: { label: "글 종류", optionLabels: { article: "글", video: "동영상", link: "링크" } },
					videoUrl: { label: "동영상 주소" },
					linkUrl: { label: "링크 주소" },
				},
			},
		},
		admin,
	);
	const post = async (title: string, values: Record<string, unknown>, on: boolean) => {
		const made = (await monti.run(
			"entries.create",
			{ collection: "post", locale: "ko", title, slug: title, values },
			admin,
		)) as { output: { id: string } };
		if (on) await monti.run("entries.publish", { ids: [made.output.id], date: "keep" }, admin);
		return made.output.id;
	};
	await post("loud-video", { mood: "loud", format: "video", videoUrl: "https://example.dev/v.mp4" }, true);
	await post("loud-draft", { mood: "loud", format: "article" }, false);
	await post("calm-article", { mood: "calm", format: "article" }, true);
}

export const site = (
	options: {
		files?: typeof devFiles | null;
		more?: (site: StorySite) => Promise<void>;
		schema?: typeof schema;
		plugins?: MontiOptions["plugins"];
	} = {},
) => [
	async () => {
		// The draft keeps unsaved changes in this browser (doc 05); every story starts from the saved values, at the first screen.
		startAt();
		const made = await storySite({
			schema: options.schema ?? schema,
			auth: { password: true },
			signedIn: true,
			setup,
			files: options.files === undefined ? devFiles : options.files,
			plugins: options.plugins,
		});
		await options.more?.(made);
		return { site: made };
	},
];

/** Fills a field as typing would, through the input's change event (`userEvent.type` does not reach these inputs). */
const fill = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

/** Waits until the open sheet has gone, so the next click reaches the page instead of its closing backdrop. */
const sheetGone = (body: ReturnType<typeof within>) =>
	waitFor(() => expect(body.queryByRole("dialog")).toBeNull(), wait);

/** A collection in the settings' own list (the sidebar has a row of the same name). */
const collectionLink = (page: ReturnType<typeof within>, name: RegExp) =>
	within(page.getByRole("navigation", { name: "컬렉션" })).getByRole("button", { name });

/** Opens "변경 사항 ▾" once its group has settled (it appears with the first change, and a second press would close the list). */
async function openChanges(page: ReturnType<typeof within>, body: ReturnType<typeof within>) {
	const trigger = await page.findByRole("button", { name: "변경 사항" });
	await new Promise((done) => setTimeout(done, 300));
	await userEvent.click(trigger);
	await body.findByRole("menu", {}, wait);
}

/** Opens settings from the sidebar, goes to its collections tab and waits for the collections; sheets and menus are in the body, outside the canvas. */
async function settings(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
	// The tab's name ends with what its dot says when it holds a proposal.
	await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
	await page.findByRole("button", { name: "summary 열기" }, wait);
	return { page, body: within(canvasElement.ownerDocument.body) };
}

async function addField(
	{ page, body }: Awaited<ReturnType<typeof settings>>,
	kind: "글자" | "고르기" | "미디어" | "관계",
) {
	await userEvent.click(page.getByRole("button", { name: "+ 필드 추가" }));
	await userEvent.click(await body.findByRole("option", { name: new RegExp(`^${kind}`) }));
}

/** Flow 4, step 07: summary renamed to excerpt, subtitle removed, a new required choice "글 종류" with its choices. */
async function changeFields(canvasElement: HTMLElement) {
	const screen = await settings(canvasElement);
	const { page, body } = screen;
	await userEvent.click(page.getByRole("button", { name: "summary 열기" }));
	fill(await body.findByLabelText(/^식별자/), "excerpt");
	await userEvent.click(body.getByRole("button", { name: "저장" }));

	await userEvent.click(await page.findByRole("button", { name: "subtitle 열기" }));
	await userEvent.click(await body.findByRole("button", { name: "지우기" }));

	await addField(screen, "고르기");
	fill(body.getByLabelText("표시 이름"), "글 종류");
	fill(body.getByLabelText(/^식별자/), "format");
	await userEvent.click(body.getByRole("button", { name: "+ 선택지" }));
	await userEvent.click(body.getByRole("button", { name: "+ 선택지" }));
	const values = body.getAllByLabelText("값");
	const labels = body.getAllByLabelText("라벨");
	fill(values[0] as HTMLElement, "memo");
	fill(labels[0] as HTMLElement, "메모");
	fill(values[1] as HTMLElement, "essay");
	fill(labels[1] as HTMLElement, "에세이");
	await userEvent.click(body.getByRole("switch", { name: /필수/ }));
	await userEvent.click(body.getByRole("button", { name: "필드 추가" }));
	await page.findByRole("button", { name: "format 열기" });
	await sheetGone(body);
	return screen;
}

/** Settings › collections: the posts' fields as saved (Schema). */
export const Fields: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await settings(canvasElement);
	},
};

/** Flow 4, step 04: the add-field sheet on a text field. */
export const AddTextField: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const screen = await settings(canvasElement);
		await addField(screen, "글자");
		// The add button is never greyed out: pressed with no identifier, the identifier says so and takes the focus (README principle 7).
		await userEvent.click(screen.body.getByRole("button", { name: "필드 추가" }));
		await screen.body.findByText("이 칸을 채워 주세요.");
		await expect(screen.body.getByLabelText(/^식별자/)).toHaveFocus();
		await expect(screen.body.getByLabelText(/^식별자/)).toHaveAttribute("aria-invalid", "true");
		fill(screen.body.getByLabelText("표시 이름"), "읽는 시간");
		fill(screen.body.getByLabelText(/^식별자/), "readingTime");
	},
};

/** The add-field sheet on a choice field, with two choices. */
export const AddSelectField: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const screen = await settings(canvasElement);
		await addField(screen, "고르기");
		fill(screen.body.getByLabelText(/^식별자/), "format");
		await userEvent.click(screen.body.getByRole("button", { name: "+ 선택지" }));
		fill(screen.body.getAllByLabelText("값")[0] as HTMLElement, "memo");
		fill(screen.body.getAllByLabelText("라벨")[0] as HTMLElement, "메모");
	},
};

/** The add-field sheet on a media field. */
export const AddMediaField: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const screen = await settings(canvasElement);
		await addField(screen, "미디어");
		fill(screen.body.getByLabelText(/^식별자/), "gallery");
	},
};

/** SchemaAddField: the add-field sheet on a relation field. */
export const AddRelationField: Story = {
	loaders: site({ schema: relationFieldSchema }),
	play: async ({ canvasElement }) => {
		const screen = await settings(canvasElement);
		await addField(screen, "관계");
		fill(screen.body.getByLabelText("표시 이름"), "시리즈");
		fill(screen.body.getByLabelText(/^식별자/), "series");
		await expect(screen.body.getByText("가리키는 쪽 필드")).toBeInTheDocument();
		await userEvent.click(screen.body.getByRole("switch", { name: "여러 개 고르기" }));
		await expect(screen.body.getByRole("switch", { name: "순서 직접 정하기" })).toBeInTheDocument();
	},
};

/** SchemaField: a saved field's sheet, its kind fixed and its name under structure. */
export const EditField: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "summary 열기" }));
		await body.findByRole("button", { name: "지우기" });
	},
};

/** Flow 4, step 07: three changed fields, the posts marked changed, "변경 사항 3". */
export const ChangedFields: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await changeFields(canvasElement);
		await expect(page.getByRole("button", { name: "변경 사항" })).toBeInTheDocument();
	},
};

/** Flow 4, step 10: the changes list, each with its undo. */
export const ChangesList: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await changeFields(canvasElement);
		await openChanges(page, body);
	},
};

/** Flow 4, steps 11–12: the review, a choice for each change; removing a field deletes its values, so the pill is red. */
export const Review: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await changeFields(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByRole("button", { name: "지우고 적용" }, wait);
	},
};

/** Flow 4, step 08: the property panel drawn from the unsaved fields. */
export const Preview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await changeFields(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "속성 패널 미리보기" }));
		await page.findByText("미리보기");
	},
};

/**
 * Flow 4, step 09: a select with no choices. The save is not blocked: pressing it opens the review, which lists what is to fix first and has no pill;
 * a line opens its field. The preview still previews.
 */
export const FixFirst: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const screen = await settings(canvasElement);
		await addField(screen, "고르기");
		fill(screen.body.getByLabelText(/^식별자/), "format");
		await userEvent.click(screen.body.getByRole("button", { name: "필드 추가" }));
		await sheetGone(screen.body);
		await userEvent.click(screen.page.getByRole("button", { name: "저장하고 적용" }));
		const review = within(await screen.body.findByRole("dialog", {}, wait));
		await review.findByText("고칠 곳", {}, wait);
		await expect(review.queryByRole("button", { name: "적용" })).toBeNull();
		await review.findByText("선택지가 없습니다");
	},
};

/** CollectionBasics: the posts' view, structure and delete. */
export const Basics: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await page.findByText("컬렉션 지우기");
	},
};

/** The basics tab with the name and "폴더 사용" changed: each row has the dot by its name and "되돌리기" at its end, as the addresses do. */
export const BasicsChanged: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("표시 이름"), "글");
		await userEvent.click(page.getByRole("switch", { name: "폴더 사용" }));
		await waitFor(() => expect(page.getAllByRole("button", { name: "되돌리기" })).toHaveLength(2));
	},
};

/** Flow 4, steps 13–14: the public address changed, and its review (before and after, old addresses 404). */
export const AddressReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("공개 주소"), "blog");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("옛 주소는 404가 됩니다.", {}, wait);
	},
};

/** Doc 16: a preview address typed. Its line has the change dot and "되돌리기", and the hint for an empty field is gone. */
export const PreviewAddress: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("미리보기 주소"), "preview");
		await page.findByRole("button", { name: "변경 사항" });
	},
};

/** Doc 16: the preview address's review: from "공개 주소에서" to the address, and no saved data changes. */
export const PreviewAddressReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("미리보기 주소"), "preview");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("게시글 · 미리보기 주소", {}, wait);
	},
};

/** T151: a preview address that is the posts' own public address. The problem is told under the field, where it is fixed. */
export const AddressProblem: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("미리보기 주소"), "posts");
		await page.findByText("이미 쓰는 주소입니다", {}, wait);
	},
};

/** T151: the same problem at the top of the review ("고칠 곳"), with "열기" back to the field. */
export const AddressProblemReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("미리보기 주소"), "posts");
		await page.findByText("이미 쓰는 주소입니다", {}, wait);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		const review = within(await body.findByRole("dialog", {}, wait));
		await review.findByText("고칠 곳", {}, wait);
		await review.findByRole("button", { name: "열기" });
	},
};

/** CollectionEditor: the posts' editor allowance with one block turned off. */
export const Editor: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "에디터" }));
		await userEvent.click(await page.findByRole("checkbox", { name: /파일/ }, wait));
	},
};

/** Flow 4, step 01: the new collection sheet. */
export const NewCollection: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		fill(await body.findByLabelText(/^이름/), "노트");
		fill(body.getByLabelText(/^식별자/), "note");
	},
};

/** Item collections start without a public page; enabling one reveals its address. */
export const NewItemCollection: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		await userEvent.click(body.getByRole("radio", { name: /항목/ }));
		await expect(body.queryByRole("textbox", { name: "공개 주소" })).toBeNull();
	},
};

/** Flow 4, step 02: the identifier is taken. */
export const NewCollectionTaken: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		// The create button is never greyed out: pressed with both empty, each says so and the first takes the focus (README principle 7).
		await userEvent.click(await body.findByRole("button", { name: "만들기" }));
		await expect(await body.findAllByText("이 칸을 채워 주세요.")).toHaveLength(2);
		await expect(body.getByLabelText(/^이름/)).toHaveFocus();
		fill(body.getByLabelText(/^이름/), "글");
		fill(body.getByLabelText(/^식별자/), "post");
		await body.findByText("이미 쓰는 이름입니다.");
	},
};

/** Flow 4, steps 03 and 05: made, with title and slug, then its review (nothing stored changes). */
export const NewCollectionReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		fill(await body.findByLabelText(/^이름/), "노트");
		fill(body.getByLabelText(/^식별자/), "note");
		await userEvent.click(body.getByRole("button", { name: "만들기" }));
		await page.findByRole("button", { name: "title 열기" });
		await sheetGone(body);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("저장된 데이터는 바뀌지 않습니다.", {}, wait);
	},
};

/** T152: a new collection made with a preview address: its review names the address beside the public one. */
export const NewCollectionPreviewReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "+ 새 컬렉션" }));
		fill(await body.findByLabelText(/^이름/), "노트");
		fill(body.getByLabelText(/^식별자/), "note");
		await userEvent.click(body.getByRole("button", { name: "만들기" }));
		await page.findByRole("button", { name: "title 열기" });
		await sheetGone(body);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("미리보기 주소"), "preview");
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("저장된 데이터는 바뀌지 않습니다.", {}, wait);
	},
};

/** Flow 4, step 16: the memos leave the list at once; the changes list and the toast can undo it. */
export const DeleteCollection: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(collectionLink(page, /^메모/));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await userEvent.click(await page.findByRole("button", { name: "지우기" }));
		await openChanges(page, body);
		await body.findByText("컬렉션 삭제");
	},
};

/** Flow 4, step 17: the review of deleting a collection: one line and the red pill. */
export const DeleteReview: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(collectionLink(page, /^메모/));
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await userEvent.click(await page.findByRole("button", { name: "지우기" }));
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("이 컬렉션의 글이 모두 지워집니다.", {}, wait);
	},
};

/** Flow 4, step 06: the new collection is applied; the toast offers to open it. */
export const Made: Story = {
	loaders: site(),
	play: async (context) => {
		await NewCollectionReview.play?.(context);
		const body = within(context.canvasElement.ownerDocument.body);
		await userEvent.click(body.getByRole("button", { name: "적용" }));
		await body.findByText("노트 컬렉션을 만들었습니다", {}, wait);
	},
};

/** The site refuses one operation here, as a server that fails does. */
const refusing =
	(refused: string): Story["render"] =>
	(_args, { loaded }) => {
		const { transport } = (loaded as Loaded).site;
		return (
			<MontiAdmin
				transport={(name, input, options) =>
					name === refused
						? Promise.resolve({ status: 500, body: { error: "unexpected" } })
						: transport(name, input, options)
				}
				siteName="example.dev"
			/>
		);
	};

/**
 * A refused apply stays where the person acts (the feedback ladder in status.md): the review keeps open with the reason at its top, not a toast that goes.
 * The site refuses `settings.save` here.
 */
export const ApplyRefused: Story = {
	loaders: site(),
	render: refusing("settings.save"),
	play: async (context) => {
		await NewCollectionReview.play?.(context);
		const body = within(context.canvasElement.ownerDocument.body);
		await userEvent.click(body.getByRole("button", { name: "적용" }));
		await body.findByText("저장하지 못했습니다", {}, wait);
		await expect(body.getByRole("button", { name: "적용" })).toBeInTheDocument();
	},
};

/**
 * A save refused before its review opens (the site refuses `schema.plan` here): the reason is the page's banner, at the very top of the screen over
 * the title, where the frame's own banners stand (common.md). It stays until the next save's answer. The site has the assistant, so its
 * button is in the page's corner: it stands under the banner.
 */
export const SaveRefused: Story = {
	loaders: site({ plugins: [assistant({ provider: scriptedProvider().for })] }),
	render: refusing("schema.plan"),
	play: async ({ canvasElement }) => {
		const { page } = await changeFields(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await page.findByText("저장하지 못했습니다", {}, wait);
	},
};

/** The banner's review (T16): the schema file was edited by hand; "검토" opens this screen's review of what the edit changes. */
export const HandEditReview: Story = {
	loaders: site({
		more: async (made) => {
			// The database follows an older file: the memos were at /memos/:slug before the hand edit.
			const older = structuredClone(schema);
			(older.collections.memo as { path: string }).path = "/memos/:slug";
			await sql`update schema_state set applied_hash = 'before-the-hand-edit', applied_schema = ${JSON.stringify(older)}::jsonb`.execute(
				made.db,
			);
		},
	}),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await page.findByText("스키마 파일을 직접 고쳤습니다", {}, wait);
		await userEvent.click(page.getByRole("button", { name: "검토" }));
		await body.findByText("옛 주소는 404가 됩니다.", {}, wait);
	},
};

/** Flow 11, step 17: the live site: structure is locked; the view and the layout can still change. */
export const ReadOnly: Story = {
	loaders: site({ files: null }),
	play: async ({ canvasElement }) => void (await settings(canvasElement)),
};

/** Flow 11, step 17c: the live site's basic tab. */
export const ReadOnlyBasics: Story = {
	loaders: site({ files: null }),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		// The public address and the preview address are the file's: on the live site each reads as text, its lock on its own row.
		await page.findAllByRole("img", { name: "운영 사이트에서는 잠김" });
	},
};

/** The posts with a preview page of the site's own (doc 16). */
const previewSchema = defineSchema({
	...schema,
	collections: {
		...schema.collections,
		post: {
			kind: "document",
			path: "/posts/:slug",
			previewPath: "/preview/:slug",
			fields: schema.collections.post.fields,
		},
	},
});

/** Doc 16: the live site with a preview address set: it reads in the address's letters, with its lock. */
export const ReadOnlyPreviewAddress: Story = {
	loaders: site({ files: null, schema: previewSchema }),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await page.findByText("/preview/:slug");
	},
};

/** Flow 11, step 17b: the live site's field sheet: label and help edit, structure is text. */
export const ReadOnlyField: Story = {
	loaders: site({ files: null }),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "summary 열기" }));
		await body.findByText("입력 규칙");
	},
};

/** Flow 11, step 19: the schema file changed after the screen read it (another tab applied a change): the review cannot apply. */
export const Conflict: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		fill(await page.findByLabelText("공개 주소"), "blog");
		const { monti } = (loaded as Loaded).site;
		const other = structuredClone(schema);
		(other.collections.memo as { path: string }).path = "/memos/:slug";
		await monti.run("schema.apply", { draft: other, renames: [], answers: {} }, admin);
		await userEvent.click(page.getByRole("button", { name: "저장하고 적용" }));
		await body.findByText("파일이 바뀌었습니다", {}, wait);
	},
};

/** Flow 11, step 11 on the dev server: the assistant proposed a field; it is listed blue-noted and the bubble walks it. */
export const Proposal: Story = {
	loaders: site({
		more: async ({ monti }) => {
			const draft = structuredClone(schema);
			(draft.collections.post as { fields: Record<string, unknown> }).fields.readingTime = { kind: "text", max: 10 };
			const proposal = await monti.proposals.create("conversation-1", "읽는 시간 필드 더해 줘");
			await monti.proposals.add(proposal, "schema.apply", {
				draft,
				renames: [],
				answers: {},
				adminValues: { post: { fields: { readingTime: { label: "읽는 시간" } } } },
			});
		},
	}),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await page.findByRole("button", { name: "readingTime 열기" }, wait);
	},
};

/**
 * The assistant proposed a preview address for the posts, and a field beside it: the address is blue in its field on the basics, with its discard
 * and what is saved ("공개 주소에서") struck under it, and the bubble walks from the fields to it.
 */
export const PreviewAddressProposal: Story = {
	loaders: site({
		more: async ({ monti }) => {
			const draft = structuredClone(schema);
			const post = draft.collections.post as { previewPath?: string; fields: Record<string, unknown> };
			post.previewPath = "/preview/:slug";
			post.fields.readingTime = { kind: "text", max: 10 };
			const proposal = await monti.proposals.create("conversation-1", "미리보기 페이지 주소도 넣어 줘");
			await monti.proposals.add(proposal, "schema.apply", { draft, renames: [], answers: {} });
		},
	}),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await page.findByRole("button", { name: "readingTime 열기" }, wait);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await page.findByLabelText("미리보기 주소");
	},
};

/** The posts' panel in two tabs: "기본" and "SEO" (subtitle and cover). */
export const twoTabs = async ({ monti }: StorySite) => {
	await monti.run(
		"collections.updateAdminValues",
		{
			collection: "post",
			values: {
				...postValues,
				layout: [
					{ tab: "기본", fields: ["title", "slug", "summary", "category"] },
					{ tab: "SEO", fields: ["subtitle", "cover"] },
				],
			},
		},
		admin,
	);
};

/** Doc 19: a conditional field in the fields list: under its line a band for each option, with the option's fields and the way to add one. */
export const ConditionalFields: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await page.findByRole("button", { name: "videoUrl 열기" }, wait);
	},
};

/**
 * The same posts with a choice inside the video's fields (doc 19). The link has no field here, so the whole outline fits the window: a row
 * cut by the window's edge would be measured as too small to press.
 */
const nestedSchema = defineSchema({
	...optionsSchema,
	collections: {
		...optionsSchema.collections,
		post: {
			...optionsSchema.collections.post,
			fields: {
				...optionsSchema.collections.post.fields,
				format: {
					kind: "conditional",
					required: true,
					options: ["article", "video", "link"],
					fields: {
						video: {
							videoUrl: { kind: "text", required: true },
							videoHost: {
								kind: "conditional",
								options: ["own", "embed"],
								fields: { embed: { embedCode: { kind: "text" } } },
							},
						},
					},
				},
			},
		},
	},
});

/** The same posts with a field turned on and off by a switch, and a field of its own for "on" (doc 19). */
const toggleSchema = defineSchema({
	...optionsSchema,
	collections: {
		...optionsSchema.collections,
		post: {
			...optionsSchema.collections.post,
			fields: {
				...optionsSchema.collections.post.fields,
				featured: {
					kind: "conditional",
					control: "toggle",
					options: ["on"],
					fields: { on: { featuredNote: { kind: "text" } } },
				},
			},
		},
	},
});

/** Doc 19: a conditional field inside an option of another has bands of its own, further in. Every field of an option has its grip. */
export const ConditionalNestedFields: Story = {
	loaders: site({ schema: nestedSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await page.findByRole("button", { name: "embedCode 열기" }, wait);
	},
};

/** Doc 19: the field sheet of a conditional field turned on and off by a switch: its one option, nothing to add or take, and no "필수". */
export const ToggleFieldSheet: Story = {
	loaders: site({ schema: toggleSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "featured 열기" }, wait));
		await body.findByRole("switch", { name: "스위치로 켜고 끄기" }, wait);
	},
};

/** The review after the video option is taken out and its field's values are sent to the link's field (doc 19). */
async function movedIntoOption(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	const body = within(canvasElement.ownerDocument.body);
	await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
	await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
	await userEvent.click(await page.findByRole("button", { name: "format 열기" }, wait));
	await userEvent.click(await body.findByRole("button", { name: "video 빼기" }, wait));
	await userEvent.click(body.getByRole("button", { name: "저장" }));
	await sheetGone(body);
	await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }));
	await userEvent.click(await body.findByRole("radio", { name: "다른 필드로 옮기기" }, wait));
	await userEvent.click(body.getByRole("combobox", { name: "다른 필드로 옮기기" }));
	await userEvent.click(await body.findByRole("option", { name: "링크 주소" }, wait));
	return body;
}

/**
 * Doc 19: a removed field's values moved into a field of an option nobody who holds them has: the note under the choice says how many are
 * deleted, in red, and the apply is the red one.
 */
export const MovedIntoOptionDeleted: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const body = await movedIntoOption(canvasElement);
		await body.findByText("지움 1편", {}, wait);
	},
};

/** The same with the option's entries changed to the link: they take the value, and the note says how many are moved. */
export const MovedIntoOptionKept: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const body = await movedIntoOption(canvasElement);
		await userEvent.click(body.getByRole("combobox", { name: "바꾸기" }));
		await userEvent.click(await body.findByRole("option", { name: "링크" }, wait));
		await body.findByText("옮김 1편", {}, wait);
	},
};

/** Doc 19: the field sheet of a conditional field: its options, each a value and a label. */
export const ConditionalFieldSheet: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "format 열기" }, wait));
		await within(canvasElement.ownerDocument.body).findByRole("dialog", {}, wait);
	},
};

/** Docs 12 and 19: the review of an option renamed ("loud" to "noisy"): the entries that chose it, and how many of them are published. */
export const OptionRenamedReview: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "mood 열기" }, wait));
		const values = await body.findAllByRole("textbox", { name: "값" }, wait);
		fill(values[1] as HTMLElement, "noisy");
		await userEvent.click(body.getByRole("button", { name: "저장" }));
		await sheetGone(body);
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }));
		await body.findByText("mood · loud → noisy", {}, wait);
	},
};

/** Docs 12 and 19: the review of a conditional field's option taken out: its field as a removed field, and what becomes of the entries that chose it. */
export const OptionRemovedReview: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "format 열기" }, wait));
		await userEvent.click(await body.findByRole("button", { name: "video 빼기" }, wait));
		await userEvent.click(body.getByRole("button", { name: "저장" }));
		await sheetGone(body);
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }));
		await userEvent.click(await body.findByRole("combobox", { name: "바꾸기" }, wait));
		await userEvent.click(await body.findByRole("option", { name: "링크" }, wait));
		await body.findByText(/필수 필드가 비게 됩니다/, {}, wait);
	},
};

/** Doc 19: the field sheet opened from an option's "+ 필드": a new field of that option, with whose it is beside the title. */
export const OptionFieldSheet: Story = {
	loaders: site({ schema: optionsSchema, more: optionEntries }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await page.findByRole("button", { name: "글에 필드 추가" }, wait));
		await within(canvasElement.ownerDocument.body).findByText(/게시글 · 글 종류 · 글/, {}, wait);
	},
};

/**
 * Doc 19: the review of a field moved into an option (the assistant proposed the video's address as the link option's): where it went, and how
 * many entries lose its value because they chose another option.
 */
export const MovedFieldReview: Story = {
	loaders: site({
		schema: optionsSchema,
		more: async (made) => {
			await optionEntries(made);
			const draft = structuredClone(optionsSchema);
			const format = draft.collections.post.fields.format;
			if (format?.kind !== "conditional") throw new Error("the story's posts have a conditional field");
			format.fields = { link: { ...format.fields.link, ...format.fields.video } };
			const proposal = await made.monti.proposals.create("conversation-1", "동영상 주소를 링크 글의 필드로 옮겨 줘");
			await made.monti.proposals.add(proposal, "schema.apply", { draft, renames: [], answers: {} });
		},
	}),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(await page.findByRole("button", { name: "설정" }, wait));
		await userEvent.click(await page.findByRole("link", { name: /^컬렉션/ }, wait));
		await userEvent.click(await body.findByRole("button", { name: "모두 받기" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "저장하고 적용" }, wait));
		await body.findByText("값을 잃는 글", {}, wait);
	},
};

/** Two requests' proposals on the settings: a field for the posts, and the posts' folders turned off. */
const twoProposals = async ({ monti }: StorySite) => {
	const draft = structuredClone(schema);
	(draft.collections.post as { fields: Record<string, unknown> }).fields.readingTime = { kind: "text", max: 10 };
	const field = await monti.proposals.create("conversation-1", "읽는 시간 필드 더해 줘");
	await monti.proposals.add(field, "schema.apply", { draft, renames: [], answers: {} });
	const folders = await monti.proposals.create("conversation-2", "게시글 폴더는 꺼 줘");
	await monti.proposals.add(folders, "collections.updateAdminValues", {
		collection: "post",
		values: { folders: false },
	});
};

/**
 * One proposal's own card in the settings (doc 05, "one by one"; T41): the mark before the bubble opens the card of the proposal the
 * bubble points at, with discard, take and what was asked.
 */
export const ProposalCardOpen: Story = {
	loaders: site({ more: twoProposals }),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await page.findByRole("button", { name: "readingTime 열기" }, wait);
		await userEvent.click(await body.findByRole("button", { name: "제안: 읽는 시간 필드 더해 줘" }, wait));
		await body.findByRole("button", { name: "받기" }, wait);
	},
};

/** A collection's switch the assistant proposed: the proposal's dot by its name and "discard" before the switch, which stands as proposed. */
export const ProposedFoldersSwitch: Story = {
	loaders: site({ more: twoProposals }),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "기본" }));
		await page.findByRole("switch", { name: "폴더 사용" }, wait);
	},
};
