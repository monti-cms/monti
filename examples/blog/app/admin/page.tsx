import { AdminPage } from "@monti-cms/next/admin";

// The admin. This folder's name is its address: `/admin`.
export default function Admin() {
	return <AdminPage siteName="Monti 블로그" />;
}
