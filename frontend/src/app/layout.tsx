export const metadata = {
  title: 'KPI Портал — ГКУ МО «РЦТ»',
  description: 'Система KPI-отчётов',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
