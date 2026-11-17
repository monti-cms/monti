import { Banner, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useSession } from "../../session";

/** Leaves the screen for the login screen. Signed in, the admin comes back to the same address, and the editor puts back what was typed (doc 02). */
export function useSignInAgain() {
	const auth = useSession();
	return () => void auth.reload();
}

/**
 * The session ended while the admin was open (doc 15): every save is refused until the person signs in again, so it is the whole site's state, a
 * banner at the very top of every screen (common.md, the screen's banners), over any other banner of the screen. It does not take the screen away at
 * once: what is being written can be finished first. "Sign in again" goes to the login screen.
 */
export function SessionEndedBanner() {
	const { t, session } = useAdmin();
	const signInAgain = useSignInAgain();
	if (!session.ended) return null;
	return (
		<Banner tone="danger" title={t("session.ended")} meta={t("session.kept")} plainMeta>
			<TextButton variant="underline" onClick={signInAgain}>
				{t("session.signIn")}
			</TextButton>
		</Banner>
	);
}
