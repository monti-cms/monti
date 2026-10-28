import { useTranslator } from "@monti-cms/core/site";
import { Button, FormFieldError, Inline, Stack, Text, TextButton } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { commonMessages } from "../../lib/common.messages";

/**
 * The action row under an edit form: the error of the last attempt, Save (enabled while there are unsaved changes), Cancel (when `onCancel` is
 * given: a new item can be abandoned), anything extra, and Delete at the far end (when `onDelete` is given). Pair it with `useDraftEditor`.
 */
export function EditorFooter({
	dirty,
	saving = false,
	deleting = false,
	canSave = true,
	error,
	onSave,
	onCancel,
	onDelete,
	saveLabel,
	saveIcon,
	align = "start",
	children,
}: {
	dirty: boolean;
	saving?: boolean;
	deleting?: boolean;
	/** The form is complete enough to save (a name is filled in). */
	canSave?: boolean;
	error?: string | null;
	/** Called on the Save button; with a `<form onSubmit>` around the footer, pass `submit` instead. */
	onSave?: () => void;
	onCancel?: () => void;
	onDelete?: () => void;
	saveLabel?: string;
	saveIcon?: ReactNode;
	align?: "start" | "end";
	/** Extra buttons between Cancel and Delete. */
	children?: ReactNode;
}) {
	const t = useTranslator(commonMessages);
	const busy = saving || deleting;
	return (
		<Stack gap={8}>
			{error && (
				<FormFieldError>
					<Text preserveLines>{error}</Text>
				</FormFieldError>
			)}
			<Inline wrap gap={8} justify={align === "end" ? "end" : "between"}>
				<Inline wrap gap={8}>
					<Button type={onSave ? "button" : "submit"} size="sm" disabled={busy || !dirty || !canSave} onClick={onSave}>
						{saveIcon}
						{saving ? t("saving") : (saveLabel ?? t("save"))}
					</Button>
					{onCancel && (
						<Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
							{t("cancel")}
						</Button>
					)}
					{children}
				</Inline>
				{onDelete && (
					<TextButton type="button" variant="danger" disabled={busy} onClick={onDelete}>
						{deleting ? t("deleting") : t("delete")}
					</TextButton>
				)}
			</Inline>
		</Stack>
	);
}
