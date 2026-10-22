import { useTranslator } from "@monti-cms/core/site";
import { Alert, AlertDescription, Button } from "@monti-cms/ui";
import { Box } from "@monti-cms/ui/internal";
import { commonMessages } from "../../lib/common.messages";

/**
 * The one load-failure notice of a screen: what went wrong and a retry button. Screens put it in a `Box` with padding for its margins;
 * `className` is only still here for callers that have not moved yet.
 */
export function LoadErrorAlert({
	message,
	onRetry,
	className,
}: {
	message: string;
	onRetry?: () => void;
	/** @deprecated Wrap the alert in a `Box` with padding instead. */
	className?: string;
}) {
	const t = useTranslator(commonMessages);
	const alert = (
		<Alert tone="danger" layout="inline">
			<AlertDescription>{message}</AlertDescription>
			{onRetry && (
				<Button type="button" variant="outline" size="xs" onClick={onRetry}>
					{t("retry")}
				</Button>
			)}
		</Alert>
	);
	// transitional: className kept for callers that have not moved yet
	return className ? <Box className={className}>{alert}</Box> : alert;
}
