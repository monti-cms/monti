import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { BAREUN_PAGE_PATH } from "./options";
import { SpellCheckPage } from "./page";
import { BareunProvider } from "./provider";

/** Admin UI side of the Bareun checker. Plugs the checker into the editor spell check and adds the Spell check Tools page (which API key to use). */
export default defineAdminPlugin({ pages: { [BAREUN_PAGE_PATH]: SpellCheckPage }, Provider: BareunProvider });
