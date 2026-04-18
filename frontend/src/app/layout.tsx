import '@/styles/cyber.css'

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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="orb1" />
        <div className="orb2" />
        {children}
      </body>
    </html>
  )
}
