import { Banner, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";

type SchemaState = { locked: boolean; fileChanged: boolean; failedChange: string | null };

/**
 * The schema's alert line (T16): a change saved but not applied, a hand-edited schema file (dev server), or a deploy that did not run
 * `monti db:migrate` (live site). It sits directly above a screen's list, never across the top of the page, where the ✦ button is (status.md).
 */
export function SchemaBanner() {
	const { t } = useAdmin();
	const schema = useRead<SchemaState>("schema.read");
	const retry = useOperation("schema.retry");
	const state = schema.data;
	if (state?.failedChange)
		return (
			<Banner tone="danger" title={t("banner.failedChange")} meta={state.failedChange}>
				<TextButton
					loading={retry.pending}
					onClick={async () => {
						if ((await retry.run()).ok) await schema.reload();
					}}
				>
					{t("banner.applyAgain")}
				</TextButton>
			</Banner>
		);
	if (!state?.fileChanged) return null;
	// On the dev server the review lives in settings › collections (doc 01, T15); until then the line only tells.
	return state.locked ? (
		<Banner title={t("banner.migrate")} meta={t("banner.migrateMeta")} />
	) : (
		<Banner title={t("banner.fileChanged")} />
	);
}
