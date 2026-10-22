import { useTranslator } from "@monti-cms/core/site";
import { Alert, AlertDescription, Button, cn } from "@monti-cms/ui";
import { commonMessages } from "../../lib/common.messages";

/**
 * The one load-failure notice of a screen: what went wrong and a retry button. Give it margins through `className`: its width is `auto`, so margins
 * narrow it instead of pushing the retry button past the edge.
 */
export function LoadErrorAlert({
	message,
	onRetry,
	className,
}: {
	message: string;
	onRetry?: () => void;
	className?: string;
}) {
	const t = useTranslator(commonMessages);
	return (
		<Alert tone="danger" layout="inline" className={cn("w-auto", className)}>
			<AlertDescription className="col-start-auto min-w-0">{message}</AlertDescription>
			{onRetry && (
				<Button type="button" variant="outline" size="xs" onClick={onRetry} className="shrink-0">
					{t("retry")}
				</Button>
			)}
		</Alert>
	);
}
