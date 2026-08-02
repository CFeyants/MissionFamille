export const metadata = {
  title: "Missions en famille",
  description:
    "Missions et récompenses pour les enfants — gagne des points, remplis la fusée et débloque tes récompenses !",
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
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
