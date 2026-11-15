import { AiFailed, AiWorking, TextButton } from "@monti-cms/ui";
import { Renew, Spark } from "@monti-cms/ui/icons";
import { useAdmin } from "../operations/admin-context";
import { useFocusHandOff } from "../screens/frame/focus-hand-off";
import type { FillState } from "./use-fill";

/**
 * "✦ Fill" of one place, the same wherever a place has one (a field's label row, a picture's words, its caption): "✦ Fill" while it is
 * empty, "↻ Again" once it holds something, and while the model is asked, "Generating · Stop" in its place. Stopping leaves the place as
 * it was. A pointer's press leaves the caret where it was; a key's press hands the focus to "Stop", and back to the button when the work
 * ends (`useFocusHandOff`).
 */
export function FillAction({
	state,
	held,
	name,
	onFill,
	onStop,
}: {
	state: FillState;
	/** The place holds something: the button fills it again. */
	held: boolean;
	/** The place's name, for a screen reader: "Fill Summary". */
	name?: string;
	onFill: () => void;
	onStop: () => void;
}) {
	const { t } = useAdmin();
	const keep = useFocusHandOff((place) => (place.isConnected ? place.querySelector<HTMLElement>("button") : null));
	return (
		<span ref={keep}>
			{state.working ? (
				<AiWorking size="micro" onStop={onStop} />
			) : (
				<TextButton
					tone="proposal"
					size="micro"
					aria-label={name ? t(held ? "fill.againName" : "fill.name", { field: name }) : undefined}
					onMouseDown={(event) => event.preventDefault()}
					onClick={onFill}
				>
					{held ? <Renew aria-hidden /> : <Spark aria-hidden />}
					{t(held ? "fill.again" : "fill.fill")}
				</TextButton>
			)}
		</span>
	);
}

/** Why the last fill of a place gave nothing, under the place: the one failure line of AI work, with "Try again" when asking again can go. */
export function FillFailed({ state, onRetry }: { state: FillState; onRetry: () => void }) {
	if (!state.failed) return null;
	return <AiFailed onRetry={state.retry ? onRetry : undefined}>{state.failed}</AiFailed>;
}
