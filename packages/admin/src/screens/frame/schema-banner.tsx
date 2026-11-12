import { Banner, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { nextStop, useFocusHandOff } from "./focus-hand-off";

type SchemaState = { locked: boolean; fileChanged: boolean; failedChange: string | null };

/**
 * The schema's alert line (T16): a change saved but not applied, or a hand-edited schema file on the dev server. It is about the whole site, so it
 * sits in the frame's banner slot, edge to edge above every screen, which moves down under it (status.md). A live site whose database is behind its schema shows nothing: the
 * admin cannot run `monti db:migrate`, so the server's log says it (doc 01, decisions).
 */
export function SchemaBanner({ onReview }: { onReview?: () => void }) {
	const { t } = useAdmin();
	const schema = useRead<SchemaState>("schema.read", {}, { afterWrites: true });
	const retry = useOperation("schema.retry");
	const state = schema.data;
	// "Apply again" takes its line away when it works: the keyboard's focus it held goes to the page's first control, the next stop after the line.
	const handOff = useFocusHandOff((banner) => nextStop(banner));
	// The change file's name and the database's error are the developer's: the server's log has them (`schema.apply`), the line does not.
	if (state?.failedChange)
		return (
			<Banner key="failed" ref={handOff} tone="danger" title={t("banner.failedChange")}>
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
	// Its review button opens the review in settings › collections, where the person says what the hand edit means for stored values (doc 01).
	return state?.fileChanged && !state.locked ? (
		<Banner key="changed" title={t("banner.fileChanged")}>
			{onReview ? <TextButton onClick={onReview}>{t("banner.review")}</TextButton> : null}
		</Banner>
	) : null;
}
