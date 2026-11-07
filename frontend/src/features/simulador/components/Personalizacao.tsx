import { useEffect, useRef } from 'react'
import type { AjusteParcela, Parcela } from '../model/simulacao'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatarValorParcela(valor: number) {
  return formatadorMoeda.format(Math.min(999_999.99, Math.max(0, valor)))
}

function interpretarValorParcela(valor: string) {
  const digitos = valor.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 8)
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
  onChange: (indice: number, ajuste: AjusteParcela) => void
  onToggleAll: (cobrarPrincipal: boolean) => void
  onInsertAfter: (indice: number) => void
  onDelete: (indice: number) => void
  canAdd: boolean
}

export default function Personalizacao({
  parcelas,
  onChange,
  onToggleAll,
  onInsertAfter,
  onDelete,
  canAdd,
}: PersonalizacaoProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const parcelasEditaveis = parcelas.slice(0, -1)
  const todasMarcadas = parcelasEditaveis.every((parcela) => parcela.cobrarPrincipal)
  const algumaMarcada = parcelasEditaveis.some((parcela) => parcela.cobrarPrincipal)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = algumaMarcada && !todasMarcadas
    }
  }, [algumaMarcada, todasMarcadas])

  return (
    <section className="subpanel customization-panel">
      <h2>Personalize sua simulação: vencimentos, valores e cobrança de principal</h2>
      <div className="table-scroll">
        <table className="custom-table">
          <thead>
            <tr>
              <th className="installment-actions-column" scope="col">Ações</th>
              <th>Parcela</th>
              <th>Dt. vencimento</th>
              <th>Valor da parcela</th>
              <th>
                <label className="principal-header">
                  <input
                    ref={selectAllRef}
                    aria-label="Marcar principal de todas as parcelas"
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={(event) => onToggleAll(event.target.checked)}
                  />
                  <span>Principal</span>
                </label>
              </th>
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
                        title={existeDataEntre(parcela.dataVencimento, parcelas[indice + 1]?.dataVencimento)
                          ? `Inserir parcela após ${parcela.numero}`
                          : 'Não há uma data disponível entre os vencimentos'}
                        disabled={!existeDataEntre(parcela.dataVencimento, parcelas[indice + 1]?.dataVencimento)}
                        onClick={() => onInsertAfter(indice)}
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
                        onClick={() => onDelete(indice)}
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
                    min={deslocarData(parcelas[indice - 1]?.dataVencimento, 1)}
                    max={deslocarData(parcelas[indice + 1]?.dataVencimento, -1)}
                    onChange={(event) => onChange(indice, { dataVencimento: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Valor da parcela ${parcela.numero}`}
                    type="text"
                    inputMode="numeric"
                    value={formatarValorParcela(parcela.valorParcela)}
                    disabled={!parcela.cobrarPrincipal}
                    onChange={(event) => onChange(indice, { valorParcela: interpretarValorParcela(event.target.value) })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Cobrar principal da parcela ${parcela.numero}`}
                    type="checkbox"
                    checked={parcela.cobrarPrincipal}
                    disabled={indice === parcelas.length - 1}
                    title={indice === parcelas.length - 1 ? 'Obrigatório na última parcela' : undefined}
                    onChange={(event) => onChange(indice, { cobrarPrincipal: event.target.checked })}
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