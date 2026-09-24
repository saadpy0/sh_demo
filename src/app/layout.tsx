import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const ibmSans = IBM_Plex_Sans({
  variable: "--font-ibm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "Singapore Hardwares · Counter",
  description:
    "Lead and client book for Singapore Hardwares. Starts at the counter, ends in an account.",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ibmSans.variable} ${ibmMono.variable} h-full`}
    >
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"light";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r;var m=localStorage.getItem("shw-ui-mode")||localStorage.getItem("bth-ui-mode");if(m!=="desk"&&m!=="phone"){m=window.matchMedia("(max-width:768px)").matches?"phone":"desk";}e.setAttribute("data-floor",m);}catch(err){}})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
