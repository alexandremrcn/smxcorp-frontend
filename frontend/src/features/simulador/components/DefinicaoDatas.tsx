import { useEffect, useState } from 'react'
import Campo from './Campo'
import { adicionarDias, dataLocal, isPeriodicidadeVencimento, periodicidadesVencimento, type DadosSimulacao } from '../model/simulacao'

interface DefinicaoDatasProps {
  dados: DadosSimulacao
  disabled?: boolean
  primeiroVencimento: string
  diasPrimeiroVencimento: number
  avisoVencimento: string
  onChange: <K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) => void
}

export default function DefinicaoDatas({ dados, disabled = false, primeiroVencimento, diasPrimeiroVencimento, avisoVencimento, onChange }: DefinicaoDatasProps) {
  const [diaEmEdicao, setDiaEmEdicao] = useState<string | null>(null)
  const [diasEmEdicao, setDiasEmEdicao] = useState<string | null>(null)
  const [dataEmEdicao, setDataEmEdicao] = useState<string | null>(null)
  const [avisoLimiteData, setAvisoLimiteData] = useState<{ dataSimulacao: string } | null>(null)
  const [hoje, setHoje] = useState(() => dataLocal(new Date()))
  const comparacaoData = !dados.dataSimulacao || dados.dataSimulacao === hoje
    ? undefined
    : dados.dataSimulacao < hoje ? 'anterior' : 'posterior'

  useEffect(() => {
    let timer: number
    function atualizarHoje() {
      window.clearTimeout(timer)
      const agora = new Date()
      setHoje(dataLocal(agora))
      const proximaMeiaNoite = new Date(agora)
      proximaMeiaNoite.setHours(24, 0, 0, 0)
      timer = window.setTimeout(atualizarHoje, proximaMeiaNoite.getTime() - agora.getTime())
    }

    atualizarHoje()
    document.addEventListener('visibilitychange', atualizarHoje)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', atualizarHoje)
    }
  }, [])

  function atualizarDiaBase(dia: number) {
    if (dia === dados.diaBaseVencimento) return
    onChange('diaBaseVencimento', dia)
  }

  return (
    <fieldset className="panel dates-panel" disabled={disabled}>
      <legend>Configuração de datas e Sistema de Amortização</legend>
      <div className="field-list dates-fields">
        <div className="dates-fields-main">
          <Campo label="Data da simulação" htmlFor="data-simulacao">
            <input
              id="data-simulacao"
              type="date"
              value={dados.dataSimulacao}
              data-comparacao={comparacaoData}
              aria-description={comparacaoData ? `Data ${comparacaoData} à data de hoje.` : undefined}
              onChange={(event) => onChange('dataSimulacao', event.target.value)}
            />
          </Campo>
          <div className="first-due-date" role="group" aria-labelledby="primeiro-vencimento-label">
            <span className="first-due-date-title" id="primeiro-vencimento-label">Vencimento 1ª parcela</span>
            <div className="single-due-date">
                <input
                  id="dias-primeiro-vencimento"
                  aria-label="Quantidade de dias até o primeiro vencimento"
                  type="number"
                  min="1"
                  max={Math.max(3650, diasPrimeiroVencimento)}
                  step="1"
                  disabled={!dados.dataSimulacao || dados.sistemaAmortizacao === 'Price HP'}
                  title={dados.sistemaAmortizacao === 'Price HP' ? 'Price HP utiliza o vencimento padrão a partir da data da simulação.' : undefined}
                  value={diasEmEdicao ?? diasPrimeiroVencimento}
                  onChange={(event) => {
                    if (event.target.value === '') {
                      setDiasEmEdicao('')
                      return
                    }
                    const dias = Number(event.target.value)
                    setDiasEmEdicao(null)
                    setAvisoLimiteData(null)
                    onChange('primeiraDataVencimento', adicionarDias(dados.dataSimulacao, Math.max(1, Math.min(3650, Math.floor(dias)))))
                  }}
                  onBlur={() => setDiasEmEdicao(null)}
                />
                <input
                  id="data-primeiro-vencimento"
                  aria-label="Data do primeiro vencimento"
                  type="date"
                  disabled={!dados.dataSimulacao || dados.sistemaAmortizacao === 'Price HP'}
                  title={dados.sistemaAmortizacao === 'Price HP' ? 'Price HP utiliza o vencimento padrão a partir da data da simulação.' : undefined}
                  min={dados.dataSimulacao ? adicionarDias(dados.dataSimulacao, 1) : undefined}
                  max={dados.dataSimulacao ? adicionarDias(dados.dataSimulacao, Math.max(3650, diasPrimeiroVencimento)) : undefined}
                  value={dataEmEdicao ?? primeiroVencimento}
                  onChange={(event) => {
                    const data = event.target.value
                    if (!data) {
                      setDataEmEdicao('')
                      return
                    }
                    const minimo = adicionarDias(dados.dataSimulacao, 1)
                    const maximo = adicionarDias(dados.dataSimulacao, 3650)
                    const dataLimitada = data < minimo ? minimo : data > maximo ? maximo : data
                    setDataEmEdicao(null)
                    setAvisoLimiteData(data !== dataLimitada ? { dataSimulacao: dados.dataSimulacao } : null)
                    onChange('primeiraDataVencimento', dataLimitada)
                  }}
                  onBlur={() => setDataEmEdicao(null)}
                />
            </div>
            {avisoVencimento && <p className="single-due-date-status" role="status">{avisoVencimento}</p>}
            {avisoLimiteData?.dataSimulacao === dados.dataSimulacao && <p className="single-due-date-status" role="status">A data deve estar entre 1 e 3650 dias após a simulação.</p>}
          </div>
          <Campo label="Periodicidade de vencimento" htmlFor="periodicidade">
            <select id="periodicidade" value={dados.periodicidade} onChange={(event) => {
              const valor = event.target.value
              if (isPeriodicidadeVencimento(valor)) onChange('periodicidade', valor)
            }}>
              {Object.entries(periodicidadesVencimento).map(([codigo, descricao]) => (
                <option key={codigo} value={codigo}>{descricao}</option>
              ))}
            </select>
          </Campo>
          {dados.periodicidade !== 'D' && <Campo label="Dia base de vencimento" htmlFor="dia-base">
            <input
              id="dia-base"
              type="number"
              min="1"
              max="31"
              step="1"
              value={diaEmEdicao ?? dados.diaBaseVencimento}
              disabled={dados.sistemaAmortizacao === 'Price HP'}
              title={dados.sistemaAmortizacao === 'Price HP' ? 'O dia base não pode ser alterado para Price HP.' : undefined}
              onChange={(event) => {
                const valor = event.target.value
                if (valor === '') {
                  setDiaEmEdicao('')
                  return
                }
                const dia = Math.max(1, Math.min(31, Math.floor(Number(valor))))
                setDiaEmEdicao(null)
                atualizarDiaBase(dia)
              }}
              onBlur={() => setDiaEmEdicao(null)}
            />
          </Campo>}
          <Campo label="Vencimento em dias úteis" htmlFor="dias-uteis" toggle>
            <input
              id="dias-uteis"
              type="checkbox"
              checked={dados.diasUteis}
              disabled={dados.sistemaAmortizacao === 'Price HP'}
              title={dados.sistemaAmortizacao === 'Price HP' ? 'Vencimento em dias úteis não está disponível para Price HP.' : undefined}
              onChange={(event) => onChange('diasUteis', event.target.checked)}
            />
          </Campo>
          <Campo label="Sistema de Amortização" htmlFor="sistema-amortizacao">
            <select
              id="sistema-amortizacao"
              value={dados.sistemaAmortizacao}
              disabled={dados.periodicidade === 'D'}
              title={dados.periodicidade === 'D' ? 'Vencimento único utiliza o sistema Price.' : undefined}
              onChange={(event) => onChange('sistemaAmortizacao', event.target.value as DadosSimulacao['sistemaAmortizacao'])}
            >
              <option value="Price">Price</option>
              <option value="Price HP">Price HP</option>
              <option value="SAC">SAC</option>
              <option value="Especial" disabled={dados.modoValor === 'primeiraParcela'}>Especial</option>
            </select>
          </Campo>
          <Campo
            label="Period. de carência (somente juros)"
            htmlFor="periodos-carencia"
          >
            <input
              id="periodos-carencia"
              type="number"
              min="0"
              max={Math.max(0, dados.quantidadeParcelas - 1)}
              step="1"
              value={dados.periodosCarencia}
              disabled={dados.sistemaAmortizacao === 'Price HP' || dados.periodicidade === 'D' || dados.quantidadeParcelas < 2}
              title="Quantidade inicial de parcelas somente com juros; deve ser menor que a quantidade de parcelas."
              onChange={(event) => {
                const quantidadeInformada = Number(event.target.value)
                const quantidadeValida = Math.max(0, Math.min(dados.quantidadeParcelas - 1, Math.floor(quantidadeInformada) || 0))
                onChange('periodosCarencia', quantidadeValida)
              }}
            />
          </Campo>
        </div>
      </div>
    </fieldset>
  )
}