import { DescriptionItem, Text } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";

/** With fewer days left than this, the trash says them in the warning tone (doc 11). */
export const URGENT_DAYS = 7;

/** The days a thing has left in the trash, as a row of its panel's facts: the list's column, in the list's words. */
export function DaysLeftFact({ days }: { days: number }) {
	const { t } = useAdmin();
	const left = t("trash.left", { days });
	return (
		<DescriptionItem label={t("trash.column.left")}>
			{days < URGENT_DAYS ? <Text tone="warning">{left}</Text> : left}
		</DescriptionItem>
	);
}
