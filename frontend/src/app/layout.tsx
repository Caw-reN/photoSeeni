import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Toaster } from "sonner";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "SnapJoy - Online Photobooth",
  description: "A fun, vibrant online photobooth experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} font-sans h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--background)]">
        <Header />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            classNames: {
              toast: "font-bold border-2 border-[#1D1D23]",
            },
          }}
        />
      </body>
    </html>
  );
}
