import { AdminPage } from "@monti-cms/next/admin";
import { adminBlocks } from "../../monti/blocks/admin";

// The admin. This folder's name is its address: `/admin`.
export default function Admin() {
	return <AdminPage blocks={adminBlocks} siteName="Monti 블로그" />;
}
