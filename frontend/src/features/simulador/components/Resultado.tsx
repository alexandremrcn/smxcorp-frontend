import type { Parcela } from '../model/simulacao'
import { formatarMoeda, formatarNumero } from '../model/simulacao'
import { dataBackendParaISO, numeroBackend, type ResultadoSimulacao } from '../services/backend'

interface ResultadoProps {
  parcelas: Parcela[]
  simulacao?: ResultadoSimulacao | null
}

const sistemasAmortizacao: Record<number, string> = {
  1: 'Price HP',
  2: 'Price',
  3: 'SAC',
  4: 'Especial',
}

const periodicidades: Record<string, string> = {
  M: 'Mensal',
  B: 'Bimestral',
  T: 'Trimestral',
  A: 'Anual',
  D: 'Diária',
}

function moedaOuTraco(valor?: string) {
  return valor === undefined || valor === null || valor === '' ? '—' : formatarMoeda(numeroBackend(valor))
}

function percentual(valor: number) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}%`
}

export default function Resultado({ parcelas, simulacao }: ResultadoProps) {
  const taxaDecimal = simulacao
    ? simulacao.pcTaxaJuros / 100
    : 0
  const taxaMensal = simulacao?.periodicidadeTaxa === 'A'
    ? (Math.pow(1 + taxaDecimal, 1 / 12) - 1) * 100
    : taxaDecimal * 100
  const taxaAnual = simulacao?.periodicidadeTaxa === 'A'
    ? taxaDecimal * 100
    : (Math.pow(1 + taxaDecimal, 12) - 1) * 100
  const cet = simulacao ? (Math.pow(1 + taxaMensal / 100, 365 / 30) - 1) * 100 : 0
  const dataReferencia = simulacao
    ? new Date(`${dataBackendParaISO(simulacao.dtReferencia)}T12:00:00`).toLocaleDateString('pt-BR')
    : ''
  const formatarPercentual = (valor: number) => simulacao ? percentual(valor) : '—'
  const formatarTaxa = (valor?: string) => valor === undefined ? '—' : percentual(numeroBackend(valor))
  const aliquotaIof = numeroBackend('0.0082').toLocaleString('pt-BR', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })

  return (
    <section className="result-section" aria-labelledby="resultado-heading">
      <h2 className="section-heading" id="resultado-heading">Resumo</h2>
      <p className="print-note">Simulação para fins de planejamento. Valores, taxas e aprovação estão sujeitos à análise e às condições da instituição financeira. Este documento não constitui proposta ou aprovação de crédito.</p>
      {simulacao && (
        <dl className="simulation-summary">
          <div><dt>Data de referência</dt><dd>{dataReferencia}</dd></div>
          <div><dt>Taxa ao mês</dt><dd>{formatarPercentual(taxaMensal)}</dd></div>
          <div><dt>Taxa ao ano</dt><dd>{formatarPercentual(taxaAnual)}</dd></div>
          <div><dt>Base da taxa</dt><dd>{simulacao.baseTaxaJuros}</dd></div>
          <div><dt>C.E.T. base 365 ao ano</dt><dd>{formatarPercentual(cet)}</dd></div>
          <div><dt>Parcelas</dt><dd>{simulacao.qtdeParcelas}</dd></div>
          <div><dt>Valor liberado</dt><dd>{moedaOuTraco(simulacao.vlLiberado)}</dd></div>
          <div><dt>Valor financiado</dt><dd>{moedaOuTraco(simulacao.vlFinanciado)}</dd></div>
          <div><dt>Alíquota do IOF</dt><dd>{simulacao ? `${aliquotaIof}%` : '—'}</dd></div>
          <div><dt>IOF adicional</dt><dd>{formatarTaxa('0.38')}</dd></div>
          <div><dt>IOF calculado</dt><dd>{moedaOuTraco(simulacao.vlIof)}</dd></div>
          <div><dt>Sistema de amortização</dt><dd>{sistemasAmortizacao[simulacao.sistemaAmortizacao] ?? simulacao.sistemaAmortizacao}</dd></div>
          <div><dt>Periodicidade dos vencimentos</dt><dd>{periodicidades[simulacao.periodicidadeVcto] ?? simulacao.periodicidadeVcto}</dd></div>
        </dl>
      )}
      <div className="result-scroll">
        <table className="result-table">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Dt. vencimento</th>
              <th>Dias corridos</th>
              <th>Dias úteis</th>
              <th>Dias do período</th>
              <th>Valor da parcela</th>
              <th>Valor dos juros</th>
              <th>Cobrar juros</th>
              <th>Valor do principal</th>
              <th>Cobrar principal</th>
              <th>Saldo remanescente</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((parcela) => (
              <tr key={parcela.numero}>
                <td>{parcela.numero}</td>
                <td>{new Date(`${parcela.dataVencimento}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                <td>{parcela.diasCorridos}</td>
                <td>{parcela.diasUteis ?? '—'}</td>
                <td>{parcela.diasPeriodo}</td>
                <td>{formatarNumero(parcela.valorParcela)}</td>
                <td>{formatarNumero(parcela.valorJuros)}</td>
                <td>{parcela.cobrarJuros === undefined ? '—' : parcela.cobrarJuros ? 'Sim' : 'Não'}</td>
                <td>{formatarNumero(parcela.valorPrincipal)}</td>
                <td>{parcela.cobrarPrincipal ? 'Sim' : 'Não'}</td>
                <td>{formatarNumero(parcela.saldoRemanescente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}