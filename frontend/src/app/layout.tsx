import type { Metadata } from "next";
// @ts-ignore: CSS module import without declaration
import "./globals.css";

export const metadata: Metadata = {
  title: "Graph RAG Knowledge Assistant",
  description: "Query financial filings with graph-enhanced RAG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
