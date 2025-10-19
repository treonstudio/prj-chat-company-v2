import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/auth.context";
import { FeatureFlagsProvider } from "@/lib/contexts/feature-flags.context";
import { UsageControlsProvider } from "@/lib/contexts/usage-controls.context";
import { Toaster } from "sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chatku Web",
  description: "Real-time chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <FeatureFlagsProvider>
            <UsageControlsProvider>
              {children}
            </UsageControlsProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
