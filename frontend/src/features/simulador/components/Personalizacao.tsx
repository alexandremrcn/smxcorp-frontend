import { useRef, useState } from 'react'
import { formatarMoeda, type AjusteParcela, type LimitesParcela, type Parcela } from '../model/simulacao'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatarValorParcela(valor: number) {
  return formatadorMoeda.format(Math.min(999_999_999.99, Math.max(0, valor)))
}

function interpretarValorParcela(valor: string) {
  const digitos = valor.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11)
  return Number(digitos || '0') / 100
}

function deslocarData(dataISO: string | undefined, dias: number) {
  if (!dataISO) return undefined
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}`
}

function existeDataEntre(dataInicial: string, dataFinal?: string) {
  if (!dataFinal) return true
  const [anoInicial, mesInicial, diaInicial] = dataInicial.split('-').map(Number)
  const [anoFinal, mesFinal, diaFinal] = dataFinal.split('-').map(Number)
  const diasEntre = (
    Date.UTC(anoFinal, mesFinal - 1, diaFinal) - Date.UTC(anoInicial, mesInicial - 1, diaInicial)
  ) / 86_400_000
  return diasEntre > 1
}

interface PersonalizacaoProps {
  parcelas: Parcela[]
  limites: (LimitesParcela | null)[]
  limiteUltimoVencimento: string | null
  errosValores: (string | null)[]
  onChange: (indice: number, ajuste: AjusteParcela) => void
  onValorEditadoBlur: () => void
  onRestaurarValor: (indice: number) => void
  onInsertAfter: (indice: number) => void
  onDelete: (indice: number) => void
  onInicializar: () => void
  disabled: boolean
  podeInicializar: boolean
  canAdd: boolean
  vencimentoUnico: boolean
}

export default function Personalizacao({
  parcelas,
  limites,
  limiteUltimoVencimento,
  errosValores,
  onChange,
  onValorEditadoBlur,
  onRestaurarValor,
  onInsertAfter,
  onDelete,
  onInicializar,
  disabled,
  podeInicializar,
  canAdd,
  vencimentoUnico,
}: PersonalizacaoProps) {
  const valorAlteradoEmFoco = useRef(false)
  const [erroData, setErroData] = useState('')
  const limiteFormatado = limiteUltimoVencimento?.split('-').reverse().join('/')

  return (
    <section className="subpanel customization-panel">
      <div className="customization-header">
        <h2>Personalize sua simulação: vencimentos e valores</h2>
        <button className="button button-secondary" type="button" onClick={() => { setErroData(''); onInicializar() }} disabled={disabled || !podeInicializar}>
          Inicializar
        </button>
      </div>
      <div className="table-scroll">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="installment-actions-column" scope="col">Ações</th>
              <th>Parcela</th>
              <th>Dt. vencimento</th>
              <th>Valor da parcela</th>
              <th scope="col">Principal</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((parcela, indice) => (
              <tr key={`${parcela.numero}-${parcela.dataVencimento}`}>
                <td className="installment-actions-column">
                  <div className="installment-actions">
                    {canAdd && (
                      <button
                        className="insert-installment"
                        type="button"
                        aria-label={`Inserir parcela após ${parcela.numero}`}
                        title={!parcelas[indice + 1] && limiteUltimoVencimento && parcela.dataVencimento >= limiteUltimoVencimento
                          ? 'Não há data disponível antes do limite da última parcela.'
                          : existeDataEntre(parcela.dataVencimento, parcelas[indice + 1]?.dataVencimento)
                            ? `Inserir parcela após ${parcela.numero}`
                            : 'Não há uma data disponível entre os vencimentos'}
                        disabled={disabled || !existeDataEntre(parcela.dataVencimento, parcelas[indice + 1]?.dataVencimento)
                          || (!parcelas[indice + 1] && !!limiteUltimoVencimento && parcela.dataVencimento >= limiteUltimoVencimento)}
                        onClick={() => { setErroData(''); onInsertAfter(indice) }}
                      >
                        +
                      </button>
                    )}
                    {parcelas.length > 1 && (
                      <button
                        className="delete-installment"
                        type="button"
                        aria-label={`Excluir parcela ${parcela.numero}`}
                        title={`Excluir parcela ${parcela.numero}`}
                        disabled={disabled}
                        onClick={() => { setErroData(''); onDelete(indice) }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </td>
                <td>{parcela.numero}</td>
                <td>
                  <input
                    aria-label={`Vencimento da parcela ${parcela.numero}`}
                    type="date"
                    value={parcela.dataVencimento}
                    disabled={disabled}
                    readOnly={vencimentoUnico}
                    title={vencimentoUnico
                      ? 'Altere a data na configuração de vencimento único.'
                      : indice === parcelas.length - 1 && limiteFormatado
                        ? `Data máxima: ${limiteFormatado} (dois meses após o último vencimento inicial).`
                        : undefined}
                    min={deslocarData(parcelas[indice - 1]?.dataVencimento, 1)}
                    max={deslocarData(parcelas[indice + 1]?.dataVencimento, -1) ?? limiteUltimoVencimento ?? undefined}
                    aria-invalid={indice === parcelas.length - 1 && !!erroData && !!limiteUltimoVencimento}
                    aria-describedby={indice === parcelas.length - 1 && erroData && limiteUltimoVencimento ? 'erro-data-ultima-parcela' : undefined}
                    onChange={(event) => {
                      const dataVencimento = event.target.value
                      if (indice === parcelas.length - 1 && limiteUltimoVencimento && dataVencimento > limiteUltimoVencimento) {
                        setErroData(`A última parcela não pode vencer após ${limiteFormatado}.`)
                        return
                      }
                      setErroData('')
                      onChange(indice, { dataVencimento })
                    }}
                  />
                  {indice === parcelas.length - 1 && erroData && limiteUltimoVencimento && (
                    <span className="installment-error" id="erro-data-ultima-parcela" role="alert">{erroData}</span>
                  )}
                </td>
                <td>
                  <input
                    aria-label={`Valor da parcela ${parcela.numero}`}
                    type="text"
                    inputMode="numeric"
                    value={formatarValorParcela(parcela.valorParcela)}
                    disabled={disabled || indice === parcelas.length - 1 || !parcela.cobrarPrincipal || vencimentoUnico || !limites[indice]}
                    title={vencimentoUnico
                      ? 'O valor da parcela é calculado pelo sistema Price.'
                      : indice === parcelas.length - 1
                        ? 'O valor da última parcela é calculado automaticamente.'
                        : !limites[indice]
                          ? 'Calcule a simulação para obter juros e saldo de referência desta parcela.'
                          : `Último cálculo: juros ${formatarMoeda(limites[indice].juros)}; limite superior (saldo remanescente) ${formatarMoeda(limites[indice].saldoRemanescente)}.`}
                    aria-invalid={!!errosValores[indice]}
                    aria-describedby={errosValores[indice] ? `erro-valor-parcela-${parcela.numero}` : undefined}
                    onFocus={() => { valorAlteradoEmFoco.current = false }}
                    onChange={(event) => {
                      const valorParcela = interpretarValorParcela(event.target.value)
                      if (valorParcela !== parcela.valorParcela) valorAlteradoEmFoco.current = true
                      onChange(indice, { valorParcela })
                    }}
                    onBlur={() => {
                      if (valorAlteradoEmFoco.current) onValorEditadoBlur()
                      valorAlteradoEmFoco.current = false
                    }}
                  />
                  {errosValores[indice] && (
                    <span className="installment-error" id={`erro-valor-parcela-${parcela.numero}`} role="alert">
                      {errosValores[indice]}
                    </span>
                  )}
                  {errosValores[indice] && (
                    <button className="restore-installment-value" type="button" disabled={disabled} onClick={() => onRestaurarValor(indice)}>
                      Restaurar valor automático
                    </button>
                  )}
                </td>
                <td>
                  <input
                    aria-label={`Cobrar principal da parcela ${parcela.numero}`}
                    type="checkbox"
                    checked={parcela.cobrarPrincipal}
                    disabled
                    title="A cobrança de principal é definida pela configuração da simulação."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}