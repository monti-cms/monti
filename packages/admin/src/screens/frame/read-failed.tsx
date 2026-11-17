import { Banner, TextButton } from "@monti-cms/ui";
import { useState, useSyncExternalStore } from "react";
import { useAdmin } from "../../operations/admin-context";
import { firstStop, nextStop, useFocusHandOff } from "./focus-hand-off";

/**
 * A read of the open screen was refused or got no answer (`useRead`): the screen may be standing empty, or showing what it read before. One
 * banner at the very top says so on every screen, with the server's reason when it gave one, and "try again" makes every failed read again.
 * It stands in the top place of whatever holds the screen: the frame's, an editor's. Not while a screen says its own read's failure (an
 * editor's entry), and not for an ended session, which has its banner.
 */
export function ReadFailedBanner() {
	const { t, reads } = useAdmin();
	const refusal = useSyncExternalStore(reads.subscribe, reads.shown);
	const [trying, setTrying] = useState(false);
	// "Try again" goes with the banner once the reads are in: the keyboard's focus it held goes on to the page under it.
	const handOff = useFocusHandOff((banner) => nextStop(banner) ?? firstStop());
	if (!refusal) return null;
	return (
		<Banner
			ref={handOff}
			tone="danger"
			title={t("frame.readFailed")}
			meta={refusal.reason ? t(refusal.reason) : undefined}
			plainMeta
		>
			<TextButton
				loading={trying}
				onClick={() => {
					setTrying(true);
					void reads.retry().finally(() => setTrying(false));
				}}
			>
				{t("frame.readAgain")}
			</TextButton>
		</Banner>
	);
}
