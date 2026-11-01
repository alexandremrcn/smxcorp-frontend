import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PLANO_ACESSO, type CadastroUsuarioPayload, type CredenciaisLogin } from './acesso'
import './Inicio.css'

const valorPlano = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  .format(PLANO_ACESSO.valorCentavos / 100)
type ModoAcesso = 'entrar' | 'cadastro'

export default function Inicio() {
  const [loginAberto, setLoginAberto] = useState(false)
  const [modoAcesso, setModoAcesso] = useState<ModoAcesso>('entrar')
  const [mensagemAcesso, setMensagemAcesso] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (loginAberto && !dialog.open) dialog.showModal()
    if (!loginAberto && dialog.open) dialog.close()
  }, [loginAberto])

  function abrirAcesso(modo: ModoAcesso = 'entrar') {
    setModoAcesso(modo)
    setMensagemAcesso('')
    setLoginAberto(true)
  }

  function enviarAcesso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    if (modoAcesso === 'cadastro') {
      if (formData.get('aceitouCondicoes') !== 'on') return

      const cadastro: CadastroUsuarioPayload = {
        nomeCompleto: String(formData.get('nomeCompleto') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        senha: String(formData.get('password') ?? ''),
        aceitouCondicoes: true,
        plano: PLANO_ACESSO,
      }

      setMensagemAcesso(`Cadastro preparado para ${cadastro.plano.duracaoDias} dias de acesso por ${valorPlano} via Pix. Nenhum dado foi enviado: o pagamento e o armazenamento serão ativados com o backend.`)
      return
    }

    const credenciais: CredenciaisLogin = {
      email: String(formData.get('email') ?? '').trim(),
      senha: String(formData.get('password') ?? ''),
    }

    if (credenciais.email && credenciais.senha) {
      window.location.assign('/simulador')
    }
  }

  return (
    <main className="home-page">
      <header className="home-header">
        <a className="brand home-brand" href="/" aria-label="SMX Corp, página inicial">
          <span>SMX</span><span>Corp</span>
        </a>
        <nav className="home-nav" aria-label="Navegação da página inicial">
          <a href="#como-funciona">Simulador</a>
          <a href="#credito">Crédito</a>
          <a href="#investimento">Plano</a>
          <button className="home-login" type="button" onClick={() => abrirAcesso()}>Login</button>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">SMX CORP · SIMULADOR DE CRÉDITO</p>
          <h1 id="home-title">Crédito com números mais claros.</h1>
          <p className="home-lead">
            Monte cenários de financiamento, entenda os custos e organize vencimentos antes de
            conversar com uma instituição financeira.
          </p>
          <div className="home-hero-actions">
            <button className="home-login home-login--hero" type="button" onClick={() => abrirAcesso('cadastro')}>Ver plano de acesso</button>
            <a className="home-secondary-cta" href="#como-funciona">Conhecer o simulador</a>
          </div>
          <div className="home-price-inline">
            <strong>{valorPlano}</strong>
            <span>por {PLANO_ACESSO.duracaoDias} dias · pagamento via Pix</span>
          </div>
          <p className="home-login-note">Simulação para planejamento; não é oferta ou aprovação de crédito.</p>
        </div>

        <div className="home-hero-visual">
          <div className="home-preview-heading">
            <span>PRÉVIA DO PRODUTO</span>
            <span>SIMULADOR FINANCEIRO</span>
          </div>
          <div className="home-preview-window">
            <iframe
              className="home-preview-frame"
              src="/simulador"
              title="Prévia do protótipo do simulador financeiro SMX Corp"
              loading="lazy"
              tabIndex={-1}
            />
          </div>
          <div className="home-preview-caption">
            <span>Veja valores, custos e vencimentos</span>
            <span>Personalize seu fluxo financeiro</span>
          </div>
        </div>
      </section>

      <section className="home-section home-how" id="como-funciona">
        <div className="home-section-heading">
          <p className="home-eyebrow">SIMULADOR SMX CORP</p>
          <h2>Mais do que estimar uma parcela: modele o seu fluxo.</h2>
          <p>Combine os dados da operação com datas e valores personalizados para enxergar o cenário com mais contexto.</p>
        </div>
        <div className="home-simulator-grid">
          <article>
            <span className="home-detail-index">01 / VOCÊ INFORMA</span>
            <h3>Os dados da operação</h3>
            <ul>
              <li>Valor solicitado ou valor da primeira parcela, conforme o sistema escolhido</li>
              <li>Taxa de juros ao mês ou ao ano</li>
              <li>Prazo, sistema de amortização e periodicidade</li>
              <li>Data de referência, vencimento inicial e dia base</li>
            </ul>
          </article>
          <article className="home-simulator-flex">
            <span className="home-detail-index">02 / VOCÊ PERSONALIZA</span>
            <h3>O calendário e as parcelas</h3>
            <ul>
              <li>Altere vencimentos respeitando a ordem cronológica</li>
              <li>Inclua ou exclua parcelas do fluxo</li>
              <li>Ajuste o valor e a cobrança de principal por parcela</li>
              <li>Use o sistema Especial para refletir o fluxo personalizado</li>
            </ul>
            <p className="home-simulator-highlight">Flexibilidade para explorar cenários que uma simples estimativa de parcela não mostra.</p>
          </article>
          <article>
            <span className="home-detail-index">03 / VOCÊ ANALISA</span>
            <h3>O resultado completo</h3>
            <ul>
              <li>Valor liberado, financiado e IOF calculado</li>
              <li>Taxas equivalentes, base da taxa e C.E.T.</li>
              <li>Valor, vencimento, juros e principal de cada parcela</li>
              <li>Dias do período e saldo remanescente</li>
            </ul>
          </article>
        </div>
        <p className="home-product-disclaimer">Os sistemas e as regras disponíveis dependem dos parâmetros da simulação. O relatório pode ser impresso ou salvo em PDF.</p>
      </section>

      <section className="home-section home-market" id="credito">
        <div className="home-section-heading">
          <p className="home-eyebrow">INFORMAÇÃO DE CRÉDITO</p>
          <h2>Compare propostas pelo custo total.</h2>
          <p>Taxas e condições variam por modalidade, instituição e perfil. Para uma comparação útil, mantenha o mesmo valor e prazo.</p>
        </div>
        <div className="home-credit-grid">
          <article>
            <span className="home-detail-index">CET</span>
            <h3>Não olhe só a taxa</h3>
            <p>O Custo Efetivo Total considera juros, tarifas, tributos e outras despesas da operação. Use-o para comparar o custo total.</p>
            <a href="https://www.bcb.gov.br/meubc/faqs/p/o-que-e-o-custo-efetivo-total-cet" target="_blank" rel="noreferrer">Saiba mais no Banco Central ↗</a>
          </article>
          <article>
            <span className="home-detail-index">TAXAS</span>
            <h3>Consulte referências de mercado</h3>
            <p>As médias divulgadas ajudam a contextualizar o mercado, mas não garantem a taxa que será oferecida a cada cliente.</p>
            <a href="https://www.bcb.gov.br/estatisticas/txjuros" target="_blank" rel="noreferrer">Consulte taxas por modalidade ↗</a>
          </article>
          <article>
            <span className="home-detail-index">PLANEJAMENTO</span>
            <h3>Veja o fluxo até o fim</h3>
            <p>Considere o total a pagar, as datas e o impacto das parcelas no orçamento antes de contratar.</p>
          </article>
        </div>
        <p className="home-product-disclaimer">As informações de mercado são referências agregadas, não ofertas individuais. A simulação não representa aprovação de crédito.</p>
      </section>

      <section className="home-pricing" id="investimento">
        <div>
          <p className="home-eyebrow">PLANO DE ACESSO</p>
          <h2>Simule seus cenários com mais clareza.</h2>
          <p>Acesso ao simulador por {PLANO_ACESSO.duracaoDias} dias.</p>
        </div>
        <div className="home-pricing-offer">
          <strong>{valorPlano}</strong>
          <span className="home-pix-label">PIX · {PLANO_ACESSO.duracaoDias} DIAS</span>
        </div>
        <button className="home-login home-pricing-cta" type="button" onClick={() => abrirAcesso('cadastro')}>Acessar plano</button>
      </section>

      <footer className="home-footer">
        <a className="brand home-brand" href="/" aria-label="SMX Corp, página inicial"><span>SMX</span><span>Corp</span></a>
        <span>Simulador financeiro · SMX Corp</span>
        <button className="home-footer-login" type="button" onClick={() => abrirAcesso()}>Login</button>
      </footer>

      <dialog
        ref={dialogRef}
        className="login-dialog"
        aria-labelledby="login-title"
        onClose={() => setLoginAberto(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setLoginAberto(false)
        }}
      >
        <section className="login-modal">
          <div className="login-modal-header">
            <div>
              <p className="home-eyebrow">SMX CORP</p>
              <h2 id="login-title">{modoAcesso === 'cadastro' ? 'Crie sua conta' : 'Acesse sua conta'}</h2>
            </div>
            <button className="login-close" type="button" onClick={() => setLoginAberto(false)}>Fechar</button>
          </div>
          <div className="access-mode" role="group" aria-label="Tipo de acesso">
            <button type="button" aria-pressed={modoAcesso === 'entrar'} onClick={() => abrirAcesso('entrar')}>Entrar</button>
            <button type="button" aria-pressed={modoAcesso === 'cadastro'} onClick={() => abrirAcesso('cadastro')}>Criar conta</button>
          </div>
          <div className="access-plan-summary">
            <strong>{valorPlano} via Pix</strong>
            <span>{PLANO_ACESSO.duracaoDias} dias de acesso após confirmação do pagamento</span>
          </div>
          <form className="login-form" onSubmit={enviarAcesso}>
            {modoAcesso === 'cadastro' && (
              <>
                <label htmlFor="login-nome">Nome completo</label>
                <input id="login-nome" name="nomeCompleto" type="text" autoComplete="name" minLength={3} required />
              </>
            )}
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" name="email" type="email" autoComplete="email" required />
            <label htmlFor="login-password">Senha</label>
            <input id="login-password" name="password" type="password" autoComplete={modoAcesso === 'cadastro' ? 'new-password' : 'current-password'} minLength={8} required />
            {modoAcesso === 'cadastro' && (
              <label className="access-consent">
                <input name="aceitouCondicoes" type="checkbox" required />
                <span>Estou ciente de que o acesso custa {valorPlano}, via Pix, e dura {PLANO_ACESSO.duracaoDias} dias após a confirmação do pagamento.</span>
              </label>
            )}
            <button className="home-login login-submit" type="submit">
              {modoAcesso === 'cadastro' ? 'Preparar cadastro' : 'Login'}
            </button>
          </form>
          {mensagemAcesso && <p className="login-modal-feedback" role="status">{mensagemAcesso}</p>}
          <p className="login-modal-note">O checkout Pix, a autenticação e o controle dos 30 dias ainda não estão conectados. Os dados permanecem apenas no formulário.</p>
        </section>
      </dialog>
    </main>
  )
}