interface PageProps {
    params: Promise<{
        id: string;
    }>;
}
export default function EditEntryPage({ params }: PageProps): Promise<import("react").JSX.Element>;
export {};
