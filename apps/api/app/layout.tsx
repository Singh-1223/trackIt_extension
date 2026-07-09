export const metadata = {
  title: 'TrackIt API',
  description: 'Backend API for TrackIt Chrome Extension',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
