import type { ReactNode } from 'react'

interface CampoProps {
  label: ReactNode
  htmlFor: string
  children: ReactNode
  toggle?: boolean
  kind?: 'input' | 'output'
}

export default function Campo({ label, htmlFor, children, toggle = false, kind }: CampoProps) {
  return (
    <label className={`field-row${toggle ? ' field-row--toggle' : ''}${kind ? ` field-row--${kind}` : ''}`} htmlFor={htmlFor}>
      <span className="field-label">
        {label}
        {kind && <small className="field-kind">{kind === 'input' ? 'Entrada' : 'Saída'}</small>}
      </span>
      {children}
    </label>
  )
}