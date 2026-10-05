import { defineMessages } from "@monti-cms/core";

/** Labels, descriptions, and editing view text of the code explorer block. */
export const codeExplorerMessages = defineMessages("cms-blocks.code-explorer", {
	en: {
		label: "Code explorer",
		description: "A file tree with the code of the picked file",
		"open.label": "File shown first (path)",
		keywords: "files,tree,folder,project",
		files: "Files",
		untitled: "Untitled file",
		toolbar: "Code explorer tools",
		"add.file": "Add file",
		"add.folder": "Add folder",
		delete: "Delete code explorer",
		"open.first": "First file",
		"open.hint": "Empty means the first file",
	},
	ko: {
		label: "코드 탐색기",
		description: "파일 트리와 고른 파일의 코드",
		"open.label": "처음 보여 줄 파일(경로)",
		keywords: "파일,트리,폴더,프로젝트",
		files: "파일",
		untitled: "이름 없는 파일",
		toolbar: "코드 탐색기 도구",
		"add.file": "파일 추가",
		"add.folder": "폴더 추가",
		delete: "코드 탐색기 삭제",
		"open.first": "첫 파일",
		"open.hint": "비우면 첫 파일을 보여 준다",
	},
});
