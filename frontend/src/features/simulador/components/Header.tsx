interface HeaderProps {
  tema: 'claro' | 'escuro'
  onTemaChange: (tema: 'claro' | 'escuro') => void
}

export default function Header({ tema, onTemaChange }: HeaderProps) {
  const dataAtual = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Voltar à página inicial">
        <span>SMX</span><span>Corp</span>
      </a>
      <h1>Plataforma de Modelagem Financeira</h1>
      <div className="user-info">
        <label className="theme-toggle">
          <span>Claro</span>
          <input
            aria-label="Tema escuro"
            role="switch"
            type="checkbox"
            checked={tema === 'escuro'}
            onChange={(event) => onTemaChange(event.target.checked ? 'escuro' : 'claro')}
          />
          <span className="theme-toggle-track" aria-hidden="true"><span /></span>
          <span>Escuro</span>
        </label>
        <strong>Alexandre Marcon</strong>
        <span>{dataAtual}</span>
      </div>
    </header>
  )
}