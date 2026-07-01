interface ViewHintProps {
  children: React.ReactNode
}

/** Muted one-line subtitle under page titles (visible on mobile; hidden on desktop where sidebar hints show). */
export function ViewHint({ children }: ViewHintProps) {
  return <p className="pv3-view-hint">{children}</p>
}
