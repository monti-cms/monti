import { useTranslator } from "@monti-cms/core/site";
import { Alert, AlertDescription, Button } from "@monti-cms/ui";
import { commonMessages } from "../../lib/common.messages";

/** The one load-failure notice of a screen: what went wrong and a retry button. Screens put it in a `Box` with padding for its margins. */
export function LoadErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
	const t = useTranslator(commonMessages);
	return (
		<Alert tone="danger" layout="inline">
			<AlertDescription>{message}</AlertDescription>
			{onRetry && (
				<Button type="button" variant="outline" size="xs" onClick={onRetry}>
					{t("retry")}
				</Button>
			)}
		</Alert>
	);
}
