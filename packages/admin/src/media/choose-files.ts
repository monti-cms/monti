import { FILE_CHOOSER_ACCEPT } from "@monti-cms/core";

/** Opens the browser's file chooser, with no element on the page: for "Upload", wherever it is. */
export function chooseFiles({
	multiple = true,
	accept = FILE_CHOOSER_ACCEPT,
	onFiles,
}: {
	multiple?: boolean;
	accept?: string;
	onFiles: (files: File[]) => void;
}) {
	const input = document.createElement("input");
	input.type = "file";
	input.multiple = multiple;
	input.accept = accept;
	input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
	input.click();
}
