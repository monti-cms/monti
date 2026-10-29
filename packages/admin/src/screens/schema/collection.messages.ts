import { defineMessages } from "@monti-cms/core";
import { josa } from "@monti-cms/core/site";

const plural = (count: unknown, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`;

/** Text of the collection editor of the schema screen: basics, body, allowed blocks and the new-collection dialog. */
export const schemaCollectionMessages = defineMessages("cms-admin.schema.collection", {
	en: {
		"collection.titleFieldLabel": "Title",
		"collection.slugFieldLabel": "Slug",
		"collection.createTitle": "New collection",
		"collection.createConfirm": "Create",
		"collection.newName": "Name",
		"collection.newId": "Identifier",
		"collection.newIdLocked": "Cannot be changed after creation",
		"collection.kindDocumentExplain": "Posts, notes: they have a body",
		"collection.kindItemExplain": "Categories, tags: short",
		"path.slash": "Start the address with /.",
		"path.slug": "Use :slug exactly once.",
		"collection.label": "Label",
		"collection.kind": "Kind",
		"collection.path": "Public address",
		"collection.viewTitle": "View",
		"collection.structureTitle": "Structure",
		"collection.folders": "Folders",
		"collection.dangerTitle": "Delete collection",
		"collection.delete": "Delete",
		"collection.deleteUndo": "Undo",
		"collection.deleted": ({ name }) => `Deleted ${name}`,
		"collection.count": ({ entries, trashed, folders }) =>
			[
				plural(entries, "entry", "entries"),
				Number(trashed) > 0 ? `${trashed} in the trash` : null,
				Number(folders) > 0 ? plural(folders, "folder", "folders") : null,
			]
				.filter(Boolean)
				.join(" · "),
		"collection.tabs.basics": "Basics",
		"collection.tabs.fields": "Fields",
		"collection.tabs.editor": "Editor",
		"allowed.title": "Blocks and styles allowed in the body",
		"allowed.blocks": "Blocks",
		"allowed.marks": "Marks",
		"allowed.headings": "Headings",
		"allowed.all": "Allow all",
		"collection.kindText.document": "A post with a body",
		"collection.kindText.item": "A short item",
	},
	ko: {
		"collection.titleFieldLabel": "제목",
		"collection.slugFieldLabel": "주소",
		"collection.createTitle": "새 컬렉션",
		"collection.createConfirm": "만들기",
		"collection.newName": "이름",
		"collection.newId": "식별자",
		"collection.newIdLocked": "만든 뒤엔 바꿀 수 없음",
		"collection.kindDocumentExplain": "게시글, 노트처럼 본문이 있어요",
		"collection.kindItemExplain": "카테고리, 태그처럼 짧아요",
		"path.slash": "주소는 /로 시작해야 해요.",
		"path.slug": ":slug를 정확히 한 번 넣으세요.",
		"collection.label": "표시 이름",
		"collection.kind": "종류",
		"collection.path": "공개 주소",
		"collection.viewTitle": "보기",
		"collection.structureTitle": "구조",
		"collection.folders": "폴더 사용",
		"collection.dangerTitle": "컬렉션 지우기",
		"collection.delete": "지우기",
		"collection.deleteUndo": "되돌리기",
		"collection.deleted": ({ name }) => `${josa(String(name), "을", "를")} 지웠어요`,
		"collection.count": ({ entries, trashed, folders, kind }) => {
			const [noun, unit] = kind === "item" ? ["항목", "개"] : ["글", "편"];
			return [
				`${noun} ${entries}${unit}`,
				Number(trashed) > 0 ? `휴지통 ${trashed}${unit} 포함` : null,
				Number(folders) > 0 ? `폴더 ${folders}개` : null,
			]
				.filter(Boolean)
				.join(" · ");
		},
		"collection.tabs.basics": "기본",
		"collection.tabs.fields": "필드",
		"collection.tabs.editor": "에디터",
		"allowed.title": "본문에서 쓸 수 있는 블록과 서식",
		"allowed.blocks": "블록",
		"allowed.marks": "서식",
		"allowed.headings": "제목",
		"allowed.all": "모두 허용",
		"collection.kindText.document": "본문이 있는 글",
		"collection.kindText.item": "짧은 항목",
	},
});
