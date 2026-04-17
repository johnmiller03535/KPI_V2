type Props = {
  icon: string
  title: string
}

export function SectionTitle({ icon, title }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span className="cyber-title">{title}</span>
    </div>
  )
}
