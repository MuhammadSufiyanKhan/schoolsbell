import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SchoolsBell — School management, simplified",
  description:
    "Attendance, grades, fees and communication for schools, with AI that gives teachers their time back.",
};

// Light mode only, whatever the device prefers (also keeps form controls and scrollbars light).
export const viewport: Viewport = { colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
