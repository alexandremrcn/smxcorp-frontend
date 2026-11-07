import type { Parcela } from '../model/simulacao'
import { formatarMoeda } from '../model/simulacao'

interface GraficoProps {
  parcelas: Parcela[]
}

export default function Grafico({ parcelas }: GraficoProps) {
  const altura = 240
  const margem = { superior: 30, direita: 10, inferior: 50, esquerda: 50 }
  const larguraMinimaParcela = 76
  const largura = Math.max(760, margem.esquerda + margem.direita + parcelas.length * larguraMinimaParcela)
  const larguraUtil = largura - margem.esquerda - margem.direita
  const alturaUtil = altura - margem.superior - margem.inferior
  const maximo = Math.max(1, ...parcelas.map((parcela) => parcela.valorParcela))
  const intervalo = maximo / 4
  const espaco = larguraUtil / Math.max(parcelas.length, 1)
  const larguraBarra = Math.min(34, espaco * 0.58)
  const parcelasPorFaixa = 12
  const faixasImpressao = Array.from(
    { length: Math.ceil(parcelas.length / parcelasPorFaixa) },
    (_, indice) => parcelas.slice(indice * parcelasPorFaixa, (indice + 1) * parcelasPorFaixa),
  )
  const larguraImpressao = 760
  const alturaImpressao = 165
  const margemImpressao = { superior: 30, direita: 12, inferior: 46, esquerda: 55 }
  const larguraUtilImpressao = larguraImpressao - margemImpressao.esquerda - margemImpressao.direita
  const alturaUtilImpressao = alturaImpressao - margemImpressao.superior - margemImpressao.inferior
  const espacoImpressao = larguraUtilImpressao / parcelasPorFaixa
  const larguraBarraImpressao = espacoImpressao * 0.58

  return (
    <section className="subpanel chart-panel">
      <h2>Composição das parcelas por vencimento</h2>
      <div className="chart-scroll" role="region" aria-label="Gráfico das parcelas com rolagem horizontal" tabIndex={0}>
        <svg className="chart" viewBox={`0 0 ${largura} ${altura}`} style={{ minWidth: `${largura}px` }} role="img" aria-label="Gráfico de principal e juros por parcela">
          {[0, 1, 2, 3, 4].map((nivel) => {
            const y = margem.superior + alturaUtil - (alturaUtil * nivel) / 4
            return (
              <g key={nivel}>
                <line className="chart-grid" x1={margem.esquerda} x2={largura - margem.direita} y1={y} y2={y} />
                <text className="chart-axis-label" x={margem.esquerda - 8} y={y + 3} textAnchor="end">
                  {formatarMoeda((intervalo * nivel)).replace(',00', '').replace('R$', '')}
                </text>
              </g>
            )
          })}
          {parcelas.map((parcela, indice) => {
            const x = margem.esquerda + espaco * indice + (espaco - larguraBarra) / 2
            const alturaPrincipal = (parcela.valorPrincipal / maximo) * alturaUtil
            const alturaJuros = (parcela.valorJuros / maximo) * alturaUtil
            const yPrincipal = margem.superior + alturaUtil - alturaPrincipal
            const yJuros = yPrincipal - alturaJuros
            const data = new Date(`${parcela.dataVencimento}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

            return (
              <g key={parcela.numero}>
                <title>{`Parcela ${parcela.numero}: total ${formatarMoeda(parcela.valorParcela)}, principal ${formatarMoeda(parcela.valorPrincipal)}, juros ${formatarMoeda(parcela.valorJuros)}`}</title>
                <rect x={x} y={yPrincipal} width={larguraBarra} height={alturaPrincipal} fill="var(--principal)" />
                <rect x={x} y={yJuros} width={larguraBarra} height={alturaJuros} fill="var(--interest)" />
                <text className="chart-value-label" x={x + larguraBarra / 2} y={Math.max(10, yJuros - 5)} textAnchor="middle">
                  {parcela.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
                <text className="chart-date-label" x={x + larguraBarra / 2} y={altura - 26} textAnchor="middle">{data}</text>
                <text className="chart-date-label" x={x + larguraBarra / 2} y={altura - 10} textAnchor="middle">{parcela.numero}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-swatch" />Principal</span>
        <span className="legend-item"><span className="legend-swatch legend-swatch--interest" />Juros</span>
      </div>
      <div className="chart-print" aria-label="Gráfico para impressão, organizado em faixas de 12 parcelas">
        {faixasImpressao.map((faixa, indiceFaixa) => (
          <div className="chart-print-row" key={faixa[0]?.numero ?? indiceFaixa}>
            <p className="chart-print-row-title">
              Parcelas {faixa[0]?.numero} a {faixa[faixa.length - 1]?.numero}
            </p>
            <svg viewBox={`0 0 ${larguraImpressao} ${alturaImpressao}`} role="img" aria-label={`Parcelas ${faixa[0]?.numero} a ${faixa[faixa.length - 1]?.numero}`}>
              {[0, 1, 2, 3, 4].map((nivel) => {
                const y = margemImpressao.superior + alturaUtilImpressao - (alturaUtilImpressao * nivel) / 4
                return (
                  <g key={nivel}>
                    <line className="chart-grid" x1={margemImpressao.esquerda} x2={larguraImpressao - margemImpressao.direita} y1={y} y2={y} />
                    <text className="chart-axis-label" x={margemImpressao.esquerda - 8} y={y + 3} textAnchor="end">
                      {formatarMoeda((intervalo * nivel)).replace(',00', '').replace('R$', '')}
                    </text>
                  </g>
                )
              })}
              {faixa.map((parcela, indiceParcela) => {
                const x = margemImpressao.esquerda + espacoImpressao * indiceParcela + (espacoImpressao - larguraBarraImpressao) / 2
                const alturaPrincipal = (parcela.valorPrincipal / maximo) * alturaUtilImpressao
                const alturaJuros = (parcela.valorJuros / maximo) * alturaUtilImpressao
                const yPrincipal = margemImpressao.superior + alturaUtilImpressao - alturaPrincipal
                const yJuros = yPrincipal - alturaJuros
                const data = new Date(`${parcela.dataVencimento}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

                return (
                  <g key={parcela.numero}>
                    <title>{`Parcela ${parcela.numero}: total ${formatarMoeda(parcela.valorParcela)}, principal ${formatarMoeda(parcela.valorPrincipal)}, juros ${formatarMoeda(parcela.valorJuros)}`}</title>
                    <rect x={x} y={yPrincipal} width={larguraBarraImpressao} height={alturaPrincipal} fill="var(--principal)" />
                    <rect x={x} y={yJuros} width={larguraBarraImpressao} height={alturaJuros} fill="var(--interest)" />
                    <text className="chart-value-label chart-value-label--print" x={x + larguraBarraImpressao / 2} y={Math.max(10, yJuros - 5)} textAnchor="middle">
                      {parcela.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </text>
                    <text className="chart-date-label" x={x + larguraBarraImpressao / 2} y={alturaImpressao - 25} textAnchor="middle">{data}</text>
                    <text className="chart-date-label" x={x + larguraBarraImpressao / 2} y={alturaImpressao - 9} textAnchor="middle">{parcela.numero}</text>
                  </g>
                )
              })}
            </svg>
          </div>
        ))}
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-swatch" />Principal</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch--interest" />Juros</span>
        </div>
      </div>
    </section>
  )
}