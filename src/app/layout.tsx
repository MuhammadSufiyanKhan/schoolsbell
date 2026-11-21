import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SchoolsBell — School management, simplified",
  description:
    "Attendance, grades, fees and communication for schools, with AI that gives teachers their time back.",
};

// Follows the device (light or dark); the theme toggle can override it. Controls and scrollbars follow too.
export const viewport: Viewport = { colorScheme: "light dark" };

// Runs before the first paint so a saved choice never flashes the wrong theme.
const THEME_SCRIPT = "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
