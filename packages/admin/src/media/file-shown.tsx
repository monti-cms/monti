import type { MediaItem } from "@monti-cms/core";
import { FilePreview, Image } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "./file-text";

/**
 * What a tile's mono line says: its size or kind and how much it is used, and in a search, where it sits under the open folder. A file right in the open folder keeps its
 * usual line (components/list.md).
 */
export function useFileDetail(searching: boolean, open: readonly string[]) {
	const { t } = useAdmin();
	return (item: MediaItem) => {
		const under = searching ? item.path.slice(open.length) : [];
		const place = under.length > 0 ? `${under.join(" / ")} · ` : "";
		const measure = item.kind === "image" ? sizeLabel(item) : formatBytes(item.size);
		const use = item.uses > 0 ? t("library.usedBy", { count: item.uses }) : t("library.notUsed");
		return `${place}${measure ? `${measure} · ` : ""}${use}`;
	};
}

/** What a tile shows of a file: its picture, or for a file with none its icon and type (flow 6·34). */
export function FileThumb({ item }: { item: Pick<MediaItem, "kind" | "name" | "web" | "original"> }) {
	return item.kind === "image" ? (
		<Image src={previewUrl(item)} alt="" ratio="photo" radius="none" />
	) : (
		<FilePreview ext={extensionLabel(item.name)} />
	);
}
