import { useTranslator } from "@monti-cms/core/client";
import { commonMessages } from "../../lib/common.messages";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";

/** The one load-failure notice of a screen: what went wrong and a retry button. Give it margins through `className`. */
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
		<Alert variant="destructive" layout="inline" className={className}>
			<AlertDescription className="col-start-auto">{message}</AlertDescription>
			{onRetry && (
				<Button type="button" variant="outline" size="xs" onClick={onRetry}>
					{t("retry")}
				</Button>
			)}
		</Alert>
	);
}
