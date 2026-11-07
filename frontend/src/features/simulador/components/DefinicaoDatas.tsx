import { useState } from 'react'
import Campo from './Campo'
import type { DadosSimulacao } from '../model/simulacao'

interface DefinicaoDatasProps {
  dados: DadosSimulacao
  disabled?: boolean
  onChange: <K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) => void
}

export default function DefinicaoDatas({ dados, disabled = false, onChange }: DefinicaoDatasProps) {
  const [aba, setAba] = useState<'simplificado' | 'avancado'>('simplificado')

  return (
    <fieldset className="panel dates-panel" disabled={disabled}>
      <legend>Configuração de datas e Sistema de Amortização</legend>
      <div className="date-tabs" role="tablist" aria-label="Modo de definição das datas">
        <button
          id="tab-simplificado"
          type="button"
          role="tab"
          aria-controls="panel-datas"
          aria-selected={aba === 'simplificado'}
          tabIndex={aba === 'simplificado' ? 0 : -1}
          className={aba === 'simplificado' ? 'active' : ''}
          onClick={() => setAba('simplificado')}
        >
          Simplificado
        </button>
        <button
          id="tab-avancado"
          type="button"
          role="tab"
          aria-controls="panel-datas"
          aria-selected={aba === 'avancado'}
          tabIndex={aba === 'avancado' ? 0 : -1}
          className={aba === 'avancado' ? 'active' : ''}
          onClick={() => setAba('avancado')}
        >
          Avançado
        </button>
      </div>

      <div
        id="panel-datas"
        className={`field-list dates-fields ${aba === 'avancado' ? 'dates-fields--advanced' : ''}`}
        role="tabpanel"
        aria-labelledby={aba === 'simplificado' ? 'tab-simplificado' : 'tab-avancado'}
      >
        <div className="dates-fields-main">
          <Campo label="Data da simulação" htmlFor="data-simulacao">
            <input id="data-simulacao" type="date" value={dados.dataSimulacao} onChange={(event) => onChange('dataSimulacao', event.target.value)} />
          </Campo>
          <Campo label="Periodicidade de vencimento" htmlFor="periodicidade">
            <select id="periodicidade" value={dados.periodicidade} onChange={(event) => onChange('periodicidade', Number(event.target.value))}>
              <option value="1">Mensal</option>
              <option value="2">Bimestral</option>
              <option value="3">Trimestral</option>
            </select>
          </Campo>
          <Campo label="Dia base de vencimento" htmlFor="dia-base">
            <input id="dia-base" type="number" min="1" max="31" value={dados.diaBaseVencimento} onChange={(event) => {
              const dia = Math.max(1, Math.min(31, Number(event.target.value)))
              onChange('diaBaseVencimento', dia)
              if (!dados.primeiraDataVencimento) return
              const [ano, mes] = dados.primeiraDataVencimento.split('-')
              const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
              onChange('primeiraDataVencimento', `${ano}-${mes}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`)
            }} />
          </Campo>
          <Campo label="Vencimento em dias úteis" htmlFor="dias-uteis" toggle>
            <input
              id="dias-uteis"
              type="checkbox"
              checked={dados.diasUteis}
              onChange={(event) => onChange('diasUteis', event.target.checked)}
            />
          </Campo>
          <Campo label="Sistema de Amortização" htmlFor="sistema-amortizacao">
            <select
              id="sistema-amortizacao"
              value={dados.sistemaAmortizacao}
              onChange={(event) => onChange('sistemaAmortizacao', event.target.value as DadosSimulacao['sistemaAmortizacao'])}
            >
              <option value="Price">Price</option>
              <option value="Price HP">Price HP</option>
              <option value="SAC">SAC</option>
              <option value="Especial" disabled={dados.modoValor === 'primeiraParcela'}>Especial</option>
            </select>
          </Campo>
          {aba === 'avancado' && (
            <>
              <Campo
                label="Qtde de parcelas de principal"
                htmlFor="parcelas-principal"
              >
                <input
                  id="parcelas-principal"
                  type="number"
                  min="1"
                  max={dados.quantidadeParcelas}
                  value={dados.qtdeParcelasPrincipal}
                  onChange={(event) => {
                    const quantidadeInformada = Number(event.target.value)
                    const quantidadeValida = Math.max(1, Math.min(dados.quantidadeParcelas, quantidadeInformada || 1))
                    onChange('qtdeParcelasPrincipal', quantidadeValida)
                  }}
                />
              </Campo>
              <Campo
                label="Qtde de dias de carência"
                htmlFor="dias-carencia"
              >
                <input
                  id="dias-carencia"
                  type="number"
                  min="0"
                  max="3650"
                  value={dados.diasCarencia}
                  onChange={(event) => onChange('diasCarencia', Math.max(0, Math.min(3650, Number(event.target.value))))}
                />
              </Campo>
            </>
          )}
        </div>
      </div>
    </fieldset>
  )
}