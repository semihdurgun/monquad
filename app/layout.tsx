import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrivyProvider from "./components/PrivyProvider";
import { AuthProvider } from "./hooks/useAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MonQuad",
  description: "MONQUAD on Monad Games",
  icons: {
    icon: "/assets/monquad-fav1.png",
  },
  openGraph: {
    images: "/assets/monquad-fav1.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "MONQUAD",
    description: "MONQUAD on Monad Games",
    images: "/monadcast_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PrivyProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
