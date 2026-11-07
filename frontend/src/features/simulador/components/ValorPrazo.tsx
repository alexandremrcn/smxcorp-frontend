import Campo from './Campo'
import { MAX_PARCELAS } from '../model/simulacao'
import type { DadosSimulacao } from '../model/simulacao'

interface ValorPrazoProps {
  dados: DadosSimulacao
  valorIof?: string
  disabled?: boolean
  onChange: <K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) => void
}

interface MoedaInputProps {
  id: string
  value: number
  onValueChange?: (valor: number) => void
  readOnly?: boolean
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatarMoeda(valor: number) {
  return formatadorMoeda.format(Math.min(999_999_999.99, Math.max(0, valor)))
}

function interpretarMoeda(valor: string) {
  const digitos = valor.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11)
  return Number(digitos || '0') / 100
}

function MoedaInput({ id, value, onValueChange, readOnly = false }: MoedaInputProps) {
  return (
    <input
      id={id}
      className="currency-input"
      type="text"
      inputMode="numeric"
      value={formatarMoeda(value)}
      readOnly={readOnly}
      onChange={(event) => onValueChange?.(interpretarMoeda(event.target.value))}
    />
  )
}

export default function ValorPrazo({ dados, valorIof, disabled = false, onChange }: ValorPrazoProps) {
  const numeroIof = Number((valorIof ?? '0').replace(',', '.'))

  return (
    <fieldset className="panel" disabled={disabled}>
      <legend>Valores e prazo</legend>
      <div className="field-list">
        <div className="valor-mode-control" role="radiogroup" aria-label="Valor informado na simulação">
          <label>
            <input
              type="radio"
              name="modo-valor"
              checked={dados.modoValor === 'credito'}
              onChange={() => onChange('modoValor', 'credito')}
            />
            <span>Valor liberado</span>
          </label>
          <label>
            <input
              type="radio"
              name="modo-valor"
              checked={dados.modoValor === 'primeiraParcela'}
              onChange={() => onChange('modoValor', 'primeiraParcela')}
            />
            <span>Valor da 1ª parcela</span>
          </label>
        </div>
        <Campo
          label="Valor líquido liberado"
          htmlFor="valor-credito"
          kind={dados.modoValor === 'credito' ? 'input' : undefined}
        >
          <MoedaInput
            id="valor-credito"
            value={dados.valorCredito}
            readOnly={dados.modoValor !== 'credito'}
            onValueChange={(valor) => onChange('valorCredito', valor)}
          />
        </Campo>
        <Campo
          label="Valor da 1ª parcela"
          htmlFor="valor-primeira-parcela"
          kind={dados.modoValor === 'primeiraParcela' ? 'input' : undefined}
        >
          <MoedaInput
            id="valor-primeira-parcela"
            value={dados.valorPrimeiraParcela}
            readOnly={dados.modoValor !== 'primeiraParcela'}
            onValueChange={(valor) => onChange('valorPrimeiraParcela', valor)}
          />
        </Campo>
        <Campo label="Valor financiado" htmlFor="valor-financiamento" kind="output">
          <MoedaInput
            id="valor-financiamento"
            value={dados.valorFinanciamento}
            readOnly
          />
        </Campo>
        <Campo label="Quantidade de parcelas" htmlFor="quantidade-parcelas" kind="input">
          <input id="quantidade-parcelas" type="number" min="1" max={MAX_PARCELAS} step="1" value={dados.quantidadeParcelas} disabled={dados.periodicidade === 'D'} title={dados.periodicidade === 'D' ? 'Vencimento único possui uma parcela.' : `Máximo de ${MAX_PARCELAS} parcelas.`} onChange={(event) => onChange('quantidadeParcelas', Number(event.target.value))} />
        </Campo>
        <Campo label="Valor do IOF" htmlFor="valor-iof" kind="output">
          <input
            id="valor-iof"
            className="currency-input"
            type="text"
            value={formatarMoeda(Number.isFinite(numeroIof) ? numeroIof : 0)}
            readOnly
          />
        </Campo>
        <Campo label="Valor dos encargos / tarifas" htmlFor="valor-tarifa" kind="input">
          <MoedaInput
            id="valor-tarifa"
            value={dados.valorTarifa}
            onValueChange={(valor) => onChange('valorTarifa', valor)}
          />
        </Campo>
      </div>
    </fieldset>
  )
}