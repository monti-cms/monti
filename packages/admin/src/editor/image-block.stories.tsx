import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { userEvent, within } from "storybook/test";
import { testSite } from "../../../core/test/site";
import type { MediaItem } from "../api/media";
import { SlotRegistryProvider, type SlotSource } from "../slots/slots";
import { type FakeApi, PageFrame } from "../stories/screen-frame";
import { storedDoc } from "../test/stored-doc";
import { BLOCK_ID_ATTRIBUTE } from "./block-ids";
import { openMediaPicker } from "./block-inserts";
import { openImageCard } from "./image-alt";
import { beginImageUpload, setImageUploadPercent } from "./image-upload";
import { editorMediaMessages } from "./media.messages";
import { CmsEditor } from "./tiptap-editor";

const meta = { title: "Screens/Editor images", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const t = testSite.createTranslator(editorMediaMessages);
const API = "/api/monti/v1";

/** A flat colored square, so the picker's tiles have something to show without a network. */
const picture = (color: string) =>
	`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${color}"/></svg>`)}`;
const media = (id: string, filename: string, mimeType: string, fields: Partial<MediaItem> = {}): MediaItem => ({
	id,
	folderId: null,
	status: "ready",
	filename,
	mimeType,
	byteSize: 1_258_291,
	width: mimeType.startsWith("image/") ? 2400 : null,
	height: mimeType.startsWith("image/") ? 1600 : null,
	publicUrl: mimeType.startsWith("image/") ? picture("#a69479") : null,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: "2026-10-01T09:30:00.000Z",
	referencesCount: 0,
	references: [],
	...fields,
});
const LIBRARY = [
	media("desk", "desk-morning.jpg", "image/jpeg", { referencesCount: 1 }),
	media("night", "seoul-night.jpg", "image/jpeg", { publicUrl: picture("#3a3f55") }),
	media("cafe", "cafe-window.jpg", "image/jpeg", { publicUrl: picture("#6d5a44") }),
	media("price", "price-list-2026.pdf", "application/pdf"),
	media("subs", "subscribers.csv", "text/csv", { byteSize: 48_000 }),
];
const folder = (id: string, name: string, parentId: string | null, position: number, entryCount: number) => ({
	id,
	collection: "media",
	parentId,
	name,
	position,
	version: 1,
	entryCount,
});

const api: FakeApi = (path) => {
	const url = new URL(path, "http://localhost");
	if (url.pathname === `${API}/folders`)
		return [
			folder("blog", "Blog Assets", null, 0, 14),
			folder("covers", "covers", "blog", 0, 6),
			folder("wall", "Wallpapers", null, 1, 8),
		];
	if (url.pathname === `${API}/media`) {
		const kind = url.searchParams.get("kind");
		const items = LIBRARY.filter((item) =>
			kind ? (item.mimeType?.startsWith("image/") ? "image" : "file") === kind : true,
		);
		return { items, total: items.length };
	}
	const found = LIBRARY.find((item) => url.pathname === `${API}/media/${item.id}`);
	return found ? { ...found, mediaId: found.id } : {};
};

const para = (value: string) => ({ type: "paragraph", content: [{ type: "text", text: value }] });
const BODY = [
	para("목록에는 제목과 주소, 지금 상태만 남겼다."),
	para("편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다."),
];

/** A picture of the site (`/story-images` is a static folder of Storybook): an editor image needs an address of the site, which a data URL is not. */
const PICTURE = "/story-images/desk.svg";
const PICTURE_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="1376" height="480" viewBox="0 0 1376 480"><rect width="1376" height="480" fill="#a99578"/><circle cx="1090" cy="120" r="56" fill="#ece3d0"/><path d="M0 480V330l260-130 220 150 200-110 260 160 436-190v270z" fill="#6e5e45" opacity=".6"/></svg>';

/** The fill actions of the image's alt text and caption, as a source of the assistant gives them: they answer after a moment. */
const imageSource: SlotSource = (request) =>
	request.slot === "image"
		? [
				{
					id: request.target,
					label: request.target === "alt" ? "대체 텍스트 쓰기" : "캡션 쓰기",
					apply: "replace",
					run: () =>
						new Promise((resolve) =>
							setTimeout(() => resolve({ kind: "text", text: "책상 위 노트북에 열린 편집기" }), 400),
						),
				},
			]
		: [];

/** The editor on a body, with the image slot attached. `select` selects the n-th image once the editor is there (a clicked image). */
function Editor({
	blocks,
	select,
	onEditor,
}: {
	blocks: object[];
	select?: number;
	onEditor?: (editor: TiptapEditor) => void;
}) {
	return (
		<PageFrame api={api} pathname="/admin/posts/first">
			<SlotRegistryProvider sources={[imageSource]}>
				<div className="mx-auto h-[900px] w-full max-w-3xl overflow-hidden bg-monti-page">
					<CmsEditor
						doc={storedDoc(...(BODY as never[]), ...(blocks as never[]))}
						onChange={() => {}}
						onEditor={(editor) => {
							if (!editor) return;
							if (select !== undefined) {
								const positions: number[] = [];
								editor.state.doc.descendants((node, pos) => {
									if (node.type.name === "image") positions.push(pos);
								});
								const pos = positions[select];
								if (pos !== undefined) editor.commands.setNodeSelection(pos);
							}
							onEditor?.(editor);
						}}
					/>
				</div>
			</SlotRegistryProvider>
		</PageFrame>
	);
}

/** A pasted image at the cursor while it goes up: faded under the page ground, the bar along its bottom edge, and no ring. */
export const Uploading: Story = {
	tags: ["visual"],
	render: () => (
		<Editor
			blocks={[]}
			onEditor={(editor) => {
				// An image that is going up is not part of the stored document, so it goes in through the editor, as a paste does.
				// The same picture as the site one, as the file the person pasted (the story's fetch answers from the fake server, so it cannot read it).
				beginImageUpload("story-upload", new File([PICTURE_SVG], "pasted.svg", { type: "image/svg+xml" }));
				setImageUploadPercent("story-upload", 64);
				editor.commands.insertContentAt(editor.state.doc.content.size, {
					type: "image",
					attrs: { uploadId: "story-upload", alt: "", caption: "", align: "center" },
				});
			}}
		/>
	),
};

/** The selected image: the 2px ring on the picture, the tool row above it, the caption with its fill action under it, and the card: width, alt text, decorative. */
export const ImageCard: Story = {
	tags: ["visual"],
	render: () => <Editor blocks={[{ type: "image", attrs: { src: PICTURE, alt: "" } }]} select={0} />,
	play: async ({ canvasElement }) => {
		const settings = await within(canvasElement).findByRole("button", { name: t("imageNode.settings") });
		await userEvent.click(settings);
	},
};

/** Opened from the to-dos (or by "next image"): the alt text alone in a card over the picture, and "next image" while another image still has none. */
export const NextImage: Story = {
	tags: ["visual"],
	render: () => (
		<Editor
			blocks={[
				{ type: "image", attrs: { src: PICTURE, alt: "책상 위 노트북에 열린 편집기" } },
				{ type: "image", attrs: { src: PICTURE, alt: "" } },
			]}
			onEditor={(editor) => {
				let first: string | undefined;
				editor.state.doc.descendants((node) => {
					if (!first && node.type.name === "image") first = node.attrs[BLOCK_ID_ATTRIBUTE];
				});
				if (first) openImageCard(editor, first);
			}}
		/>
	),
	play: async () => {
		await within(document.body).findByRole("button", { name: /다음 이미지/ }, { timeout: 10000 });
	},
};

/** A file chosen with "/ 파일": icon, name, kind and size. */
export const FileBlock: Story = {
	tags: ["visual"],
	render: () => <Editor blocks={[{ type: "file", attrs: { mediaId: "price" } }]} />,
};

/** "/ 이미지": the library with its folders. */
export const ImagePicker: Story = {
	tags: ["visual"],
	render: () => <Editor blocks={[]} />,
	play: async () => {
		openMediaPicker("image");
	},
};

/** "/ 파일": the same library with files only. */
export const FilePicker: Story = {
	tags: ["visual"],
	render: () => <Editor blocks={[]} />,
	play: async () => {
		openMediaPicker("file");
	},
};
