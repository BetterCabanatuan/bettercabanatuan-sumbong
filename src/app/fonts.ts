import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// Same family as bettercabanatuan.org.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

// Only for Report codes (CBN-7K3Q2A), which people read back and type.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
  display: "swap",
});
