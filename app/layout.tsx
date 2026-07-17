import type { Metadata } from "next";
import { AppChrome } from "@/app/components/app-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ava",
  description: "Personal and business AI operating system dashboard",
  icons: {
    icon: "/ava-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
