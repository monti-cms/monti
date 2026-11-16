import { TextButton } from "@monti-cms/ui";
import { ChevronLeft } from "@monti-cms/ui/icons";
import type { ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import type { SchemaRead } from "../settings/schema-draft";

/** The way back at the start of an editor's head: the name of the list it goes to, after a chevron. */
export function EditorBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
	return (
		<TextButton variant="quiet" onClick={onBack}>
			<ChevronLeft aria-hidden />
			{children}
		</TextButton>
	);
}

/** The way back to a collection's list, under the collection's name. */
export function CollectionBack({ collection, onBack }: { collection: string; onBack: () => void }) {
	const schema = useRead<SchemaRead>("schema.read");
	return <EditorBack onBack={onBack}>{schema.data?.adminValues[collection]?.label ?? collection}</EditorBack>;
}

/** The way back to the body templates. */
export function TemplatesBack({ onBack }: { onBack: () => void }) {
	const { t } = useAdmin();
	return <EditorBack onBack={onBack}>{t("templates.back")}</EditorBack>;
}
