export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string
  title: string
  lede: string
}) {
  return (
    <header className="mb-6 max-w-2xl">
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight text-balance">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground text-pretty">{lede}</p>
    </header>
  )
}
