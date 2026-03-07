import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AskMyDocs - AI Document Intelligence',
    description: 'AI-driven document intelligence assistant using Retrieval-Augmented Generation (RAG).',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <main className="h-screen w-screen p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                    {children}
                </main>
            </body>
        </html>
    );
}
