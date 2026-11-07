import { useState } from 'react'
import type { DadosSimulacao } from '../model/simulacao'
import { formatarMoeda, taxaMensalBase360 } from '../model/simulacao'

interface JurosProps {
  dados: DadosSimulacao
  totalJuros: number
  disabled?: boolean
  onChange: <K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) => void
}

function percentual(valor: number) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}%`
}

function formatarEntradaTaxa(valor: number) {
  return percentual(Math.min(999.999, Math.max(0, valor)))
}

function interpretarEntradaTaxa(valor: string) {
  const normalizado = valor.replace('%', '').replace(/\./g, ',').replace(/[^\d,]/g, '')
  const separador = normalizado.indexOf(',')
  const inteiro = (separador < 0 ? normalizado : normalizado.slice(0, separador)).slice(0, 3)
  const decimal = separador < 0 ? '' : normalizado.slice(separador + 1).replaceAll(',', '').slice(0, 3)
  const numero = Number(`${inteiro || '0'}${decimal ? `.${decimal}` : ''}`)
  const formatado = `${Number(inteiro || '0')}${separador >= 0 ? `,${decimal}` : ''}%`

  return {
    formatado,
    numero: Math.min(999.999, numero),
  }
}

interface EntradaTaxaProps {
  ariaLabel: string
  value: number
  onChange: (value: number) => void
}

function EntradaTaxa({ ariaLabel, value, onChange }: EntradaTaxaProps) {
  const [focada, setFocada] = useState(false)
  const [texto, setTexto] = useState('')

  return (
    <input
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      value={focada ? texto : formatarEntradaTaxa(value)}
      onFocus={() => {
        setTexto(formatarEntradaTaxa(value))
        setFocada(true)
      }}
      onChange={(event) => {
        const entrada = interpretarEntradaTaxa(event.target.value)
        setTexto(entrada.formatado)
        onChange(entrada.numero)
      }}
      onBlur={() => setFocada(false)}
    />
  )
}

export default function Juros({ dados, onChange, totalJuros, disabled = false }: JurosProps) {
  const taxaMensal360 = taxaMensalBase360(dados)
  const fatorMensal360 = 1 + taxaMensal360
  const taxaAnualInformada = dados.periodicidadeTaxa === 'A' ? dados.taxaJuros : 0
  const taxaMensalInformada = dados.periodicidadeTaxa === 'M' ? dados.taxaJuros : 0
  const taxaAnual360 = dados.periodicidadeTaxa === 'A'
    ? dados.taxaJuros
    : (Math.pow(fatorMensal360, 12) - 1) * 100
  const taxaMensal252 = (Math.pow(fatorMensal360, 21 / 30) - 1) * 100
  const taxaAnual252 = (Math.pow(1 + taxaMensal252 / 100, 12) - 1) * 100
  const cetAnual365 = (Math.pow(fatorMensal360, 365 / 30) - 1) * 100

  return (
    <fieldset className="panel interest-panel" disabled={disabled}>
      <legend>Taxa de Juros</legend>
      <section className="interest-input" aria-labelledby="taxas-entrada">
        <h3 className="interest-group-title" id="taxas-entrada">Taxa informada — Base 360</h3>
        <div className="interest-base-values">
          <label className={`interest-value interest-value--input${dados.periodicidadeTaxa === 'M' ? ' interest-value--selected' : ''}`}>
            <span>ao mês{dados.periodicidadeTaxa === 'M' ? ' (informada)' : ''}</span>
            <EntradaTaxa
              ariaLabel="Taxa de juros ao mês, base 360"
              value={taxaMensalInformada}
              onChange={(valor) => {
                onChange('taxaJuros', valor)
                onChange('periodicidadeTaxa', 'M')
              }}
            />
          </label>
          <label className={`interest-value interest-value--input${dados.periodicidadeTaxa === 'A' ? ' interest-value--selected' : ''}`}>
            <span>ao ano{dados.periodicidadeTaxa === 'A' ? ' (informada)' : ''}</span>
            <EntradaTaxa
              ariaLabel="Taxa de juros ao ano, base 360"
              value={taxaAnualInformada}
              onChange={(valor) => {
                onChange('taxaJuros', valor)
                onChange('periodicidadeTaxa', 'A')
              }}
            />
          </label>
        </div>
        <p className="interest-input-hint">Digite no campo desejado para trocar o critério; a outra taxa será zerada.</p>
      </section>

      <div className="interest-grid" role="group" aria-label="Taxas equivalentes">
        <section className="interest-base" aria-labelledby="taxas-equivalentes-360">
          <h3 className="interest-group-title" id="taxas-equivalentes-360">Base 360</h3>
          <div className="interest-base-values">
            <label className="interest-value interest-value--output">
              <span>ao mês</span>
              <output aria-label="Taxa equivalente ao mês, base 360">{percentual(taxaMensal360 * 100)}</output>
            </label>
            <label className="interest-value interest-value--output">
              <span>ao ano</span>
              <output aria-label="Taxa equivalente ao ano, base 360">{percentual(taxaAnual360)}</output>
            </label>
          </div>
        </section>

        <section className="interest-base" aria-labelledby="taxas-equivalentes-252">
          <h3 className="interest-group-title" id="taxas-equivalentes-252">Base 252</h3>
          <div className="interest-base-values">
            <label className="interest-value interest-value--output">
              <span>ao mês</span>
              <output aria-label="Taxa equivalente ao mês, base 252">{percentual(taxaMensal252)}</output>
            </label>
            <label className="interest-value interest-value--output">
              <span>ao ano</span>
              <output aria-label="Taxa equivalente ao ano, base 252">{percentual(taxaAnual252)}</output>
            </label>
          </div>
        </section>
      </div>
      <div className="interest-summary">
        <span className="interest-summary-label">C.E.T. base 365 ao ano</span>
        <output className="interest-summary-value">{percentual(cetAnual365)}</output>
        <span className="interest-summary-label">Valor dos juros a pagar</span>
        <output className="interest-summary-value">{formatarMoeda(totalJuros)}</output>
      </div>
    </fieldset>
  )
}
