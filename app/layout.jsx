export const metadata = {
  title: "Familiemissies",
  description:
    "Missies en beloningen voor de kinderen — verdien punten, vul de raket en speel je beloningen vrij!",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#171738",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
