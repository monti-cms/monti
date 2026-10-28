import { defineMessages } from "@monti-cms/core";
import { josa } from "@monti-cms/core/site";

const plural = (count: unknown, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`;

/** Text of the collection editor of the schema screen: basics, body, allowed blocks and the new-collection dialog. */
export const schemaCollectionMessages = defineMessages("cms-admin.schema.collection", {
	en: {
		"collection.createTitle": "New collection",
		"collection.createConfirm": "Create collection",
		"collection.newName": "Collection name",
		"collection.newId": "Identifier",
		"collection.newIdHint": "Cannot be changed later.",
		"collection.kindDocumentExplain": "Posts with a body, e.g. posts, notes",
		"collection.kindItemExplain": "Short entries without a body, e.g. categories, tags",
		"path.slash": "Start the address with /.",
		"path.slug": "Use :slug exactly once.",
		"collection.label": "Label",
		"collection.kind": "Kind",
		"collection.icon": "Icon",
		"collection.iconDefault": "Default for the kind",
		"collection.iconSearch": "Search icons...",
		"collection.iconNone": "No matching icon.",
		"collection.iconClear": "Use default icon",
		"collection.path": "Public address",
		"collection.basicsTitle": "Basics",
		"collection.featuresTitle": "Features",
		"collection.folders": "Folders",
		"collection.summary": "{kind} · {path}",
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
		"allowed.note": "Only limits newly added blocks; existing content is preserved.",
		"allowed.blocks": "Blocks",
		"allowed.marks": "Marks",
		"allowed.headings": "Headings",
		"allowed.all": "Allow all",
	},
	ko: {
		"collection.createTitle": "새 컬렉션",
		"collection.createConfirm": "컬렉션 만들기",
		"collection.newName": "컬렉션 이름",
		"collection.newId": "식별자",
		"collection.newIdHint": "생성 후 변경할 수 없어요.",
		"collection.kindDocumentExplain": "본문이 있는 글. 예: 게시글, 노트",
		"collection.kindItemExplain": "본문 없는 짧은 항목. 예: 카테고리, 태그",
		"path.slash": "주소는 /로 시작해야 해요.",
		"path.slug": ":slug를 정확히 한 번 넣으세요.",
		"collection.label": "표시 이름",
		"collection.kind": "종류",
		"collection.icon": "아이콘",
		"collection.iconDefault": "종류별 기본값",
		"collection.iconSearch": "아이콘 검색...",
		"collection.iconNone": "일치하는 아이콘이 없어요.",
		"collection.iconClear": "기본 아이콘으로 설정",
		"collection.path": "공개 주소",
		"collection.basicsTitle": "기본 정보",
		"collection.featuresTitle": "기능",
		"collection.folders": "폴더 사용",
		"collection.summary": "{kind} · {path}",
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
		"allowed.note": "새로 추가하는 블록에만 적용되며, 기존 내용은 유지돼요.",
		"allowed.blocks": "블록",
		"allowed.marks": "서식",
		"allowed.headings": "제목",
		"allowed.all": "모두 허용",
	},
});
