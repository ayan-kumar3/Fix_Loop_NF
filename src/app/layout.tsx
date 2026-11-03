import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/toaster";
import { ScrollEffects } from "@/components/scroll-effects";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FixLoop — Report it. Track it. Fix it.",
    template: "%s · FixLoop",
  },
  description:
    "FixLoop is an AI-powered, community-driven platform for reporting local infrastructure problems and tracking them through to verified resolution.",
  keywords: ["civic tech", "issue reporting", "community", "AI", "smart society"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem("fixloop-theme");
              } catch (error) {
                console.warn("Could not read the saved theme; using the system preference.", error);
              }
              var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              var useDarkTheme = savedTheme === "dark" || (savedTheme !== "light" && prefersDark);
              document.documentElement.classList.toggle("dark", useDarkTheme);
              document.documentElement.style.colorScheme = useDarkTheme ? "dark" : "light";
            `,
          }}
        />
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster />
          <ScrollEffects />
        </ThemeProvider>
      </body>
    </html>
  );
}