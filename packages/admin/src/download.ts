/** Saves JSON as a file the browser downloads (an export from the list or the editor). */
export function download(name: string, data: unknown) {
	const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, "\t")], { type: "application/json" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}
