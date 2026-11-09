import { useEffect, useRef, useState } from 'react'
import Header from './components/Header.tsx'
import ValorPrazo from './components/ValorPrazo'
import DefinicaoDatas from './components/DefinicaoDatas'
import Juros from './components/Juros'
import Personalizacao from './components/Personalizacao'
import Grafico from './components/Grafico'
import Resultado from './components/Resultado'
import {
  MAX_PARCELAS,
  criarDadosZerados,
  formatarMoeda,
  gerarParcelas,
  isPeriodicidadeVencimento,
  mesesPorPeriodicidade,
  periodicidadesVencimento,
  sugerirDataVencimento,
  validarValorParcela,
  type AjusteParcela,
  type DadosSimulacao,
  type LimitesParcela,
  type Parcela,
} from './model/simulacao'
import {
  ajustarVencimentoParaDiaUtil,
  calcularDatasVencimento,
  calcularSimulacao,
  dataBackendParaISO,
  dataISOParaBackend,
  numeroBackend,
  type ResultadoSimulacao,
  type SolicitarSimulacao,
} from './services/backend'
import './simulador.css'

type Tema = 'claro' | 'escuro'
type ConfiguracaoAntesPersonalizacao = Pick<
  DadosSimulacao,
  'quantidadeParcelas' | 'primeiraDataVencimento' | 'diaBaseVencimento' | 'sistemaAmortizacao'
>

function sistemaAmortizacaoBackend(sistema: DadosSimulacao['sistemaAmortizacao']) {
  const codigos = {
    'Price HP': '1',
    Price: '2',
    SAC: '3',
    Especial: '4',
  } satisfies Record<DadosSimulacao['sistemaAmortizacao'], string>
  return codigos[sistema]
}

function diferencaEmDias(inicio: string, fim: string) {
  const [anoInicio, mesInicio, diaInicio] = inicio.split('-').map(Number)
  const [anoFim, mesFim, diaFim] = fim.split('-').map(Number)
  return Math.round((
    Date.UTC(anoFim, mesFim - 1, diaFim) - Date.UTC(anoInicio, mesInicio - 1, diaInicio)
  ) / 86_400_000)
}

function proximoMes(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const proximoMes = new Date(ano, mes, 1)
  const ultimoDia = new Date(proximoMes.getFullYear(), proximoMes.getMonth() + 1, 0).getDate()
  return `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`
}

function montarPedidoSimulacao(
  dados: DadosSimulacao,
  parcelas: Parcela[],
  datasVencimento: string[],
  ajustes: AjusteParcela[],
  sistemaAmortizacao: DadosSimulacao['sistemaAmortizacao'],
  vlSolicitado: number,
  vl1aParcela: number,
): SolicitarSimulacao {
  if (dados.periodicidade === 'D' && sistemaAmortizacao !== 'Price') {
    throw new Error('Vencimento único exige o sistema de amortização Price.')
  }
  if (sistemaAmortizacao === 'Price HP' && dados.diasUteis) {
    throw new Error('Vencimento em dias úteis não está disponível para Price HP.')
  }

  const pedido: SolicitarSimulacao = {
    vlSolicitado: vlSolicitado.toFixed(2),
    vl1aParcela: vl1aParcela.toFixed(2),
    dtReferencia: dataISOParaBackend(dados.dataSimulacao),
    vlEncargos: dados.valorTarifa.toFixed(2),
    idTaxaFator: 'T',
    taxa: dados.taxaJuros.toString(),
    periodicidadeTaxa: dados.periodicidadeTaxa,
    baseTaxa: String(dados.baseDias),
    periodicidadeVcto: dados.periodicidade,
    idDiaUtil: dados.diasUteis ? 'S' : 'N',
    tipoJuros: 'S',
    qtdeParcelas: String(parcelas.length),
    qtdeDiasCarencia: '0',
    diaBaseVencimento: String(dados.diaBaseVencimento),
    cdSistemaAmortizacao: sistemaAmortizacaoBackend(sistemaAmortizacao),
    tpNegociacaoIof: dados.modoValor === 'primeiraParcela' ? '2' : '1',
    idIofEmbutido: 'N',
    pcAliquotaIOF: '0.0082',
    pcAliquotaAdicional: '0.38',
  }

  if (sistemaAmortizacao === 'Especial') {
    pedido.idCobrJuros = parcelas.map(() => 'S')
    pedido.idCobrPrinc = parcelas.map((parcela) => parcela.cobrarPrincipal ? 'S' : 'N')
    pedido.vlParcelaIn = parcelas.map((parcela, indice) => (
      parcela.cobrarPrincipal && ajustes[indice]?.valorEditado
        ? (ajustes[indice].valorParcela ?? 0).toFixed(2)
        : '0.00'
    ))
    pedido.idTipoParcelaIn = parcelas.map((_, indice) => (
      ajustes[indice]?.valorParcela !== undefined && !ajustes[indice]?.valorEditado ? 'N' : 'A'
    ))
  } else {
    pedido.idCobrJuros = parcelas.map(() => 'S')
    pedido.idCobrPrinc = parcelas.map(() => 'S')
    pedido.vlParcelaIn = parcelas.map(() => '0.00')
    pedido.idTipoParcelaIn = parcelas.map(() => 'A')
  }

  if (sistemaAmortizacao !== 'Price HP') {
    pedido.dtVencimento = datasVencimento.map(dataISOParaBackend)
  }

  return pedido
}

function valorFinanceiroNegativo(resultado: ResultadoSimulacao) {
  const valoresResumo: [string, string][] = [
    ['valor liberado', resultado.vlLiberado],
    ['valor financiado', resultado.vlFinanciado],
    ['IOF', resultado.vlIof],
    ['valor da primeira parcela', resultado.vl1aParela],
  ]
  const valorNegativo = valoresResumo.find(([, valor]) => numeroBackend(valor) < 0)
  if (valorNegativo) return valorNegativo[0]

  const parcelasFinanceiras: [string, string[]][] = [
    ['valor da parcela', resultado.vlParcela],
    ['valor dos juros', resultado.vlJuros],
    ['valor do principal', resultado.vlPrincipal],
    ['saldo remanescente', resultado.vlSdoRemanescente],
  ]
  for (const [descricao, valores] of parcelasFinanceiras) {
    const indiceNegativo = valores.findIndex((valor) => numeroBackend(valor) < 0)
    if (indiceNegativo >= 0) return `${descricao} da parcela ${indiceNegativo + 1}`
  }

  return null
}

function parcelasPrevistas(dados: DadosSimulacao, ajustes: AjusteParcela[]) {
  if (
    !dados.dataSimulacao
    || !dados.primeiraDataVencimento
    || !Number.isInteger(dados.quantidadeParcelas)
    || dados.quantidadeParcelas < 1
    || dados.quantidadeParcelas > MAX_PARCELAS
  ) {
    return []
  }

  let dataAnterior = dados.dataSimulacao
  return gerarParcelas(dados, ajustes).map((parcela) => {
    const dataVencimento = parcela.dataVencimento
    const parcelaComDatas = {
      ...parcela,
      diasCorridos: diferencaEmDias(dados.dataSimulacao, dataVencimento),
      diasPeriodo: diferencaEmDias(dataAnterior, dataVencimento),
    }
    dataAnterior = dataVencimento
    return parcelaComDatas
  })
}

function contarPeriodosCarencia(cobrancasPrincipal: boolean[]) {
  const primeiroPrincipal = cobrancasPrincipal.findIndex(Boolean)
  return primeiroPrincipal < 0 ? cobrancasPrincipal.length : primeiroPrincipal
}

function parcelasDaSimulacao(resultado: ResultadoSimulacao): Parcela[] {
  let dataAnterior = dataBackendParaISO(resultado.dtReferencia)

  return resultado.numParcela.map((numero, indice) => {
    const dataVencimento = dataBackendParaISO(resultado.dtVencimento[indice])
    const parcela: Parcela = {
      numero,
      dataVencimento,
      diasCorridos: resultado.qtdeDiasCorr[indice],
      diasPeriodo: diferencaEmDias(dataAnterior, dataVencimento),
      diasUteis: resultado.qtdeDiasUteis[indice],
      valorParcela: numeroBackend(resultado.vlParcela[indice]),
      cobrarJuros: resultado.idCobraJuros[indice] === 'S',
      cobrarPrincipal: resultado.idCobraPrincipal[indice] === 'S',
      valorJuros: numeroBackend(resultado.vlJuros[indice]),
      valorPrincipal: numeroBackend(resultado.vlPrincipal[indice]),
      saldoRemanescente: numeroBackend(resultado.vlSdoRemanescente[indice]),
    }
    dataAnterior = dataVencimento
    return parcela
  })
}

export default function Simulador() {
  const [tema, setTema] = useState<Tema>(() => (
    localStorage.getItem('smxcorp-tema') === 'escuro' ? 'escuro' : 'claro'
  ))
  const [dados, setDados] = useState<DadosSimulacao>(criarDadosZerados)
  const [ajustes, setAjustes] = useState<AjusteParcela[]>([])
  const [limitesParcelas, setLimitesParcelas] = useState<(LimitesParcela | null)[]>([])
  const [avisoImpressao, setAvisoImpressao] = useState('')
  const [incluirGraficoPdf, setIncluirGraficoPdf] = useState(true)
  const [resultadoSimulacao, setResultadoSimulacao] = useState<ResultadoSimulacao | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [erroBackend, setErroBackend] = useState('')
  const [resultadoDescartado, setResultadoDescartado] = useState(false)
  const [personalizacaoPendente, setPersonalizacaoPendente] = useState(false)
  const [vencimentoAjustado, setVencimentoAjustado] = useState<{ chave: string; data?: string; erro?: string } | null>(null)
  const calculoAtual = useRef(0)
  const calculoAposEdicao = useRef<number | null>(null)
  const sistemaAmortizacaoAntesPersonalizacao = useRef<DadosSimulacao['sistemaAmortizacao']>('Price')
  const configuracaoAntesPersonalizacao = useRef<ConfiguracaoAntesPersonalizacao | null>(null)
  const dataInformada = dados.primeiraDataVencimento
  const chaveVencimento = `${dados.sistemaAmortizacao}|${dados.periodicidade}|${dados.dataSimulacao}|${dataInformada}`
  const precisaAjustar = !!dados.dataSimulacao && !!dataInformada && (
    (dados.periodicidade === 'D' && dados.diasUteis) || dados.sistemaAmortizacao === 'Price HP'
  )
  const ajusteAtual = vencimentoAjustado?.chave === chaveVencimento ? vencimentoAjustado : null
  const primeiroVencimento = precisaAjustar ? ajusteAtual?.data ?? '' : dataInformada
  const dataExibida = primeiroVencimento || dataInformada
  const diasPrimeiroVencimento = dados.dataSimulacao && dataExibida
    ? diferencaEmDias(dados.dataSimulacao, dataExibida)
    : 0
  const avisoVencimentoUnico = precisaAjustar && !primeiroVencimento
    ? ajusteAtual?.erro ?? 'Consultando o vencimento no backend...'
    : ''
  const dadosParaCalculo = { ...dados, primeiraDataVencimento: primeiroVencimento }
  const parcelasEmPrevia = parcelasPrevistas(dadosParaCalculo, ajustes)
  const manterPreviaNoErro = erroBackend !== '' && dados.sistemaAmortizacao === 'Especial'
  const parcelas = resultadoDescartado || (erroBackend && !manterPreviaNoErro)
    ? []
    : resultadoSimulacao
      ? parcelasDaSimulacao(resultadoSimulacao)
      : parcelasEmPrevia
  const parcelasParaAnalise = personalizacaoPendente ? [] : parcelas
  const errosValores = parcelas.map((parcela, indice) => {
    const ajuste = ajustes[indice]
    if (resultadoSimulacao || !parcela.cobrarPrincipal || !ajuste?.valorEditado || ajuste.valorParcela === undefined) return null
    const limites = limitesParcelas[indice]
    if (!limites) return 'Calcule a simulação para obter os limites desta parcela.'
    if (validarValorParcela(ajuste.valorParcela, limites)) return null
    return `Informe valor igual ou superior aos juros (${formatarMoeda(limites.juros)}) e menor que o saldo remanescente (${formatarMoeda(limites.saldoRemanescente)}) do último cálculo.`
  })
  const temValorInvalido = errosValores.some(Boolean)
  const totalJuros = parcelas.reduce((total, parcela) => total + parcela.valorJuros, 0)
  const podeExportar = resultadoSimulacao !== null && !calculando && !personalizacaoPendente && !erroBackend

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    localStorage.setItem('smxcorp-tema', tema)
  }, [tema])

  useEffect(() => {
    document.title = 'Plataforma de Modelagem Financeira | SMX Corp'
  }, [])

  useEffect(() => () => {
    if (calculoAposEdicao.current !== null) window.clearTimeout(calculoAposEdicao.current)
  }, [])

  useEffect(() => {
    if (!precisaAjustar) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      controller.abort()
      setVencimentoAjustado({ chave: chaveVencimento, erro: 'Não foi possível ajustar o vencimento: a consulta ao backend demorou demais.' })
    }, 15000)
    const consulta = dados.sistemaAmortizacao === 'Price HP'
      ? calcularDatasVencimento({
          dataSimulacao: dados.dataSimulacao,
          primeiraDataVencimento: dataInformada,
          diaBaseVencimento: dados.diaBaseVencimento,
          diasUteis: dados.diasUteis,
          periodicidade: dados.periodicidade,
          sistemaAmortizacao: dados.sistemaAmortizacao,
          quantidadeParcelas: 1,
        }, controller.signal).then((datas) => datas[0])
      : ajustarVencimentoParaDiaUtil(dados.dataSimulacao, dataInformada, controller.signal)
    consulta
      .then((data) => setVencimentoAjustado({ chave: chaveVencimento, data }))
      .catch((erro: unknown) => {
        if (controller.signal.aborted) return
        setVencimentoAjustado({
          chave: chaveVencimento,
          erro: erro instanceof Error ? `Não foi possível ajustar o vencimento: ${erro.message}` : 'Não foi possível ajustar o vencimento.',
        })
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [precisaAjustar, dados.dataSimulacao, dados.sistemaAmortizacao, dados.periodicidade, dados.diaBaseVencimento, dados.diasUteis, dataInformada, chaveVencimento])

  function atualizarDado<K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) {
    if (dados.periodicidade === 'D' && (campo === 'sistemaAmortizacao' || campo === 'periodosCarencia')) return
    // Alterar uma entrada após o cálculo invalida resultado, gráfico e fluxo de vencimentos.
    const havia = resultadoSimulacao !== null
    const estavaNoFluxoEspecial = dados.sistemaAmortizacao === 'Especial'
    if (havia) setResultadoDescartado(true)

    if (campo === 'periodosCarencia' && typeof valor === 'number') {
      guardarConfiguracaoAntesPersonalizacao()
      const quantidadeValida = Math.max(0, Math.min(dados.quantidadeParcelas - 1, Math.floor(valor) || 0))
      const parcelasAtuais = parcelas.length ? parcelas : parcelasEmPrevia
      const novosAjustes = parcelasAtuais.map((_, indice) => ({
        ...ajustes[indice],
        cobrarPrincipal: indice >= quantidadeValida,
      }))

      calculoAtual.current += 1
      setResultadoSimulacao(null)
      setResultadoDescartado(false)
      setCalculando(false)
      setErroBackend('')
      setAjustes(novosAjustes)
      setDados((atuais) => {
        if (atuais.sistemaAmortizacao !== 'Especial') {
          sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
        }
        return {
          ...atuais,
          periodosCarencia: quantidadeValida,
          sistemaAmortizacao: 'Especial',
        }
      })
      return
    }

    configuracaoAntesPersonalizacao.current = null
    setLimitesParcelas([])
    if (estavaNoFluxoEspecial) {
      sistemaAmortizacaoAntesPersonalizacao.current = 'Price'
      setAjustes([])
    } else if (campo === 'sistemaAmortizacao' && valor === 'Especial') {
      sistemaAmortizacaoAntesPersonalizacao.current = dados.sistemaAmortizacao
      setAjustes([])
    } else if (campo === 'sistemaAmortizacao') {
      sistemaAmortizacaoAntesPersonalizacao.current = valor as DadosSimulacao['sistemaAmortizacao']
      setAjustes((atuais) => Array.from({ length: parcelas.length }, (_, indice) => ({
        ...atuais[indice],
        cobrarPrincipal: true,
      })))
    }
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')
    if (
      campo === 'dataSimulacao'
      || campo === 'diaBaseVencimento'
      || campo === 'primeiraDataVencimento'
      || campo === 'periodicidade'
      || campo === 'diasUteis'
      || campo === 'quantidadeParcelas'
    ) {
      setAjustes([])
    }
    setDados((atuais) => {
      const atualizados = { ...atuais, [campo]: valor }

      if (campo === 'sistemaAmortizacao' && valor === 'Especial') {
        atualizados.periodosCarencia = 0
      }

      if (campo === 'periodicidade' && valor === 'D') {
        atualizados.quantidadeParcelas = 1
        atualizados.periodosCarencia = 0
      }

      if (campo === 'quantidadeParcelas' && typeof valor === 'number') {
        atualizados.quantidadeParcelas = Math.max(0, Math.min(MAX_PARCELAS, Math.floor(valor) || 0))
        atualizados.periodosCarencia = 0
      }

      if (atualizados.periodicidade === 'D') {
        atualizados.quantidadeParcelas = 1
        atualizados.periodosCarencia = 0
        atualizados.sistemaAmortizacao = 'Price'
      }

      if (campo === 'sistemaAmortizacao' && valor === 'Price HP') {
        atualizados.diasUteis = false
        if (atuais.dataSimulacao) {
          atualizados.diaBaseVencimento = Number(atuais.dataSimulacao.slice(-2))
          atualizados.primeiraDataVencimento = proximoMes(atuais.dataSimulacao)
        }
      }

      if (campo === 'dataSimulacao' && typeof valor === 'string' && valor) {
        atualizados.primeiraDataVencimento = proximoMes(valor)
        if (atualizados.sistemaAmortizacao === 'Price HP') {
          atualizados.diaBaseVencimento = Number(valor.slice(-2))
        }
      }

      if (campo === 'modoValor') {
        if (atualizados.sistemaAmortizacao !== 'Especial') {
          sistemaAmortizacaoAntesPersonalizacao.current = atualizados.sistemaAmortizacao
        }
        atualizados.valorCredito = 0
        atualizados.valorPrimeiraParcela = 0
        atualizados.valorFinanciamento = 0
      } else if (campo === 'valorCredito' || campo === 'valorPrimeiraParcela') {
        atualizados.valorFinanciamento = 0
      }

      if (havia) {
        atualizados.valorFinanciamento = 0
        if (atualizados.modoValor === 'primeiraParcela') atualizados.valorCredito = 0
      }

      if (estavaNoFluxoEspecial && campo !== 'sistemaAmortizacao') {
        atualizados.sistemaAmortizacao = 'Price'
        atualizados.periodosCarencia = 0
      }

      if (campo === 'dataSimulacao' || campo === 'diaBaseVencimento'
        || campo === 'primeiraDataVencimento' || campo === 'periodicidade' || campo === 'diasUteis'
        || campo === 'quantidadeParcelas' || campo === 'sistemaAmortizacao') {
        atualizados.periodosCarencia = 0
      }

      return atualizados
    })
  }

  function guardarConfiguracaoAntesPersonalizacao() {
    if (configuracaoAntesPersonalizacao.current) return
    configuracaoAntesPersonalizacao.current = {
      quantidadeParcelas: dados.quantidadeParcelas,
      primeiraDataVencimento: dados.primeiraDataVencimento,
      diaBaseVencimento: dados.diaBaseVencimento,
      sistemaAmortizacao: dados.sistemaAmortizacao,
    }
  }

  function atualizarParcela(indice: number, ajuste: AjusteParcela) {
    if (dados.periodicidade === 'D') return
    if (ajuste.valorParcela !== undefined && (indice === parcelas.length - 1 || !limitesParcelas[indice])) return
    if (ajuste.dataVencimento !== undefined) {
      const dataAnterior = parcelas[indice - 1]?.dataVencimento
      const proximaData = parcelas[indice + 1]?.dataVencimento
      if (
        !ajuste.dataVencimento
        || (dataAnterior && ajuste.dataVencimento <= dataAnterior)
        || (proximaData && ajuste.dataVencimento >= proximaData)
      ) {
        return
      }
    }

    guardarConfiguracaoAntesPersonalizacao()
    setPersonalizacaoPendente(true)
    const valorFoiAlterado = ajuste.valorParcela !== undefined
      && ajuste.valorParcela !== parcelas[indice]?.valorParcela
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')
    const novosAjustes = [...ajustes]
    novosAjustes[indice] = {
      ...novosAjustes[indice],
      ...ajuste,
      valorEditado: novosAjustes[indice]?.valorEditado || valorFoiAlterado,
    }
    setAjustes(novosAjustes)
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        sistemaAmortizacao: 'Especial',
        ...(indice === 0 && ajuste.dataVencimento
          ? {
              primeiraDataVencimento: ajuste.dataVencimento,
            }
          : {}),
      }
    })
  }

  function restaurarValorParcela(indice: number) {
    setAjustes((atuais) => {
      const novos = [...atuais]
      novos[indice] = { ...novos[indice], valorParcela: undefined, valorEditado: false }
      return novos
    })
    setErroBackend('')
  }

  function inserirParcelaApos(indice: number) {
    if (parcelas.length >= MAX_PARCELAS || dados.quantidadeParcelas >= MAX_PARCELAS || dados.periodicidade === 'D') return
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')

    const novaData = sugerirDataVencimento(
      parcelas[indice].dataVencimento,
      parcelas[indice + 1]?.dataVencimento,
      mesesPorPeriodicidade(dados.periodicidade),
    )
    if (
      novaData <= parcelas[indice].dataVencimento
      || (parcelas[indice + 1] && novaData >= parcelas[indice + 1].dataVencimento)
    ) {
      return
    }
    guardarConfiguracaoAntesPersonalizacao()
    setPersonalizacaoPendente(true)
    const novosAjustes = parcelas.map((parcela, indiceParcela) => ({
      ...ajustes[indiceParcela],
      dataVencimento: parcela.dataVencimento,
      cobrarPrincipal: parcela.cobrarPrincipal,
    }))

    novosAjustes.splice(indice + 1, 0, {
      dataVencimento: novaData,
      valorParcela: 0,
      cobrarPrincipal: true,
    })

    setAjustes(novosAjustes)
    setLimitesParcelas((atuais) => {
      const limites = Array.from({ length: parcelas.length }, (_, i) => atuais[i] ?? null)
      limites.splice(indice + 1, 0, null)
      return limites
    })
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        quantidadeParcelas: atuais.quantidadeParcelas + 1,
        periodosCarencia: contarPeriodosCarencia(novosAjustes.map((ajuste) => ajuste.cobrarPrincipal)),
        sistemaAmortizacao: 'Especial',
      }
    })
  }

  function excluirParcela(indice: number) {
    if (parcelas.length <= 1) return
    guardarConfiguracaoAntesPersonalizacao()
    setPersonalizacaoPendente(true)
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')

    const novosAjustes = parcelas.map((parcela, indiceParcela) => ({
      ...ajustes[indiceParcela],
      dataVencimento: parcela.dataVencimento,
      valorParcela: ajustes[indiceParcela]?.valorEditado
        ? ajustes[indiceParcela].valorParcela
        : parcela.valorParcela,
      cobrarPrincipal: parcela.cobrarPrincipal,
    }))
    novosAjustes.splice(indice, 1)
    const ultimoAjuste = novosAjustes[novosAjustes.length - 1]
    if (ultimoAjuste) {
      novosAjustes[novosAjustes.length - 1] = {
        ...ultimoAjuste,
        cobrarPrincipal: true,
        valorParcela: undefined,
        valorEditado: false,
      }
    }

    setAjustes(novosAjustes)
    setLimitesParcelas((atuais) => {
      const limites = Array.from({ length: parcelas.length }, (_, i) => atuais[i] ?? null)
      limites.splice(indice, 1)
      return limites
    })
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        quantidadeParcelas: atuais.quantidadeParcelas - 1,
        periodosCarencia: contarPeriodosCarencia(novosAjustes.map((ajuste) => ajuste.cobrarPrincipal)),
        sistemaAmortizacao: 'Especial',
      }
    })
  }

  function inicializarPersonalizacao() {
    const configuracao = configuracaoAntesPersonalizacao.current
    configuracaoAntesPersonalizacao.current = null
    if (configuracao && configuracao.sistemaAmortizacao !== 'Especial') {
      sistemaAmortizacaoAntesPersonalizacao.current = configuracao.sistemaAmortizacao
    }
    calculoAtual.current += 1
    setAjustes([])
    setLimitesParcelas([])
    setResultadoSimulacao(null)
    setResultadoDescartado(false)
    setPersonalizacaoPendente(false)
    setCalculando(false)
    setErroBackend('')
    setAvisoImpressao('')
    setDados((atuais) => {
      const restaurados = { ...atuais, ...configuracao }
      return {
        ...restaurados,
        periodosCarencia: 0,
        valorFinanciamento: 0,
        valorCredito: restaurados.modoValor === 'primeiraParcela' ? 0 : restaurados.valorCredito,
      }
    })
  }

  function limparSimulacao() {
    calculoAtual.current += 1
    configuracaoAntesPersonalizacao.current = null
    sistemaAmortizacaoAntesPersonalizacao.current = 'Price'
    setPersonalizacaoPendente(false)
    setDados(criarDadosZerados())
    setAjustes([])
    setLimitesParcelas([])
    setResultadoSimulacao(null)
    setResultadoDescartado(false)
    setCalculando(false)
    setErroBackend('')
    setAvisoImpressao('')
  }

  function exibirErroCalculo(mensagem: string) {
    setResultadoSimulacao(null)
    setDados((atuais) => ({
      ...atuais,
      valorCredito: atuais.modoValor === 'primeiraParcela' ? 0 : atuais.valorCredito,
      valorFinanciamento: 0,
    }))
    setErroBackend(mensagem)
  }

  async function calcular() {
    if (temValorInvalido) {
      setErroBackend('Corrija os valores das parcelas destacados antes de calcular.')
      return
    }
    if (precisaAjustar && !primeiroVencimento) {
      exibirErroCalculo(avisoVencimentoUnico || 'Informe uma data de simulação válida.')
      return
    }
    if (
      !dados.dataSimulacao
      || !dadosParaCalculo.primeiraDataVencimento
      || dadosParaCalculo.primeiraDataVencimento <= dados.dataSimulacao
      || !Number.isInteger(dados.quantidadeParcelas)
      || dados.quantidadeParcelas < 1
      || dados.quantidadeParcelas > MAX_PARCELAS
      || !Number.isFinite(dados.modoValor === 'credito' ? dados.valorCredito : dados.valorPrimeiraParcela)
      || (dados.modoValor === 'credito' ? dados.valorCredito : dados.valorPrimeiraParcela) <= 0
      || !Number.isFinite(dados.taxaJuros)
      || dados.taxaJuros < 0
    ) {
      exibirErroCalculo(`Preencha as datas, informe um valor solicitado ou valor da 1ª parcela maior que zero e uma quantidade válida de parcelas (1 a ${MAX_PARCELAS}).`)
      return
    }

    const idCalculo = calculoAtual.current + 1
    calculoAtual.current = idCalculo
    setPersonalizacaoPendente(false)
    setCalculando(true)
    setErroBackend('')
    setResultadoSimulacao(null)
    setResultadoDescartado(false)

    try {
      const parcelasReferencia = gerarParcelas(dadosParaCalculo, ajustes)
      const datasPadrao = await calcularDatasVencimento(dadosParaCalculo)
      if (idCalculo !== calculoAtual.current) return
      const datasVencimento = parcelasReferencia.map((_, indice) => (
        ajustes[indice]?.dataVencimento ?? datasPadrao[indice]
      ))
      let vlSolicitado = dados.modoValor === 'credito' ? dados.valorCredito : 0
      let vl1aParcela = dados.modoValor === 'primeiraParcela' ? dados.valorPrimeiraParcela : 0

      if (dados.sistemaAmortizacao === 'Especial' && dados.modoValor === 'primeiraParcela') {
        const pedidoValorPresente = montarPedidoSimulacao(
          dadosParaCalculo,
          parcelasReferencia,
          datasVencimento,
          ajustes,
          sistemaAmortizacaoAntesPersonalizacao.current,
          0,
          dados.valorPrimeiraParcela,
        )
        const resultadoValorPresente = await calcularSimulacao(pedidoValorPresente)
        if (idCalculo !== calculoAtual.current) return
        if (resultadoValorPresente.cdResult !== 0) {
          exibirErroCalculo(resultadoValorPresente.msgResult || `O cálculo retornou o código ${resultadoValorPresente.cdResult}.`)
          return
        }
        const valorPresenteNegativo = valorFinanceiroNegativo(resultadoValorPresente)
        if (valorPresenteNegativo) {
          exibirErroCalculo(`O backend retornou ${valorPresenteNegativo} negativo. Os dados do resultado foram limpos.`)
          return
        }
        vlSolicitado = numeroBackend(resultadoValorPresente.vlLiberado)
        if (!Number.isFinite(vlSolicitado) || vlSolicitado <= 0) {
          throw new Error('Não foi possível determinar o valor presente a partir da 1ª parcela.')
        }
        vl1aParcela = 0
      }

      const valorBaseParcelas = dados.modoValor === 'credito'
        ? dados.valorCredito
        : dados.sistemaAmortizacao === 'Especial'
          ? vlSolicitado
          : 0
      const parcelasBase = gerarParcelas({ ...dadosParaCalculo, valorFinanciamento: valorBaseParcelas }, ajustes)
      const pedido = montarPedidoSimulacao(
        dadosParaCalculo,
        parcelasBase,
        datasVencimento,
        ajustes,
        dados.sistemaAmortizacao,
        vlSolicitado,
        vl1aParcela,
      )
      const resultado = await calcularSimulacao(pedido)
      if (idCalculo !== calculoAtual.current) return
      if (resultado.cdResult !== 0) {
        exibirErroCalculo(resultado.msgResult || `O cálculo retornou o código ${resultado.cdResult}.`)
        return
      }
      const resultadoNegativo = valorFinanceiroNegativo(resultado)
      if (resultadoNegativo) {
        exibirErroCalculo(`O backend retornou ${resultadoNegativo} negativo. Os dados do resultado foram limpos.`)
        return
      }
      const comprimentos = [
        resultado.numParcela.length,
        resultado.dtVencimento.length,
        resultado.qtdeDiasCorr.length,
        resultado.qtdeDiasUteis.length,
        resultado.idCobraJuros.length,
        resultado.idCobraPrincipal.length,
        resultado.vlParcela.length,
        resultado.vlJuros.length,
        resultado.vlPrincipal.length,
        resultado.vlSdoRemanescente.length,
      ]
      if (!Number.isInteger(resultado.qtdeParcelas) || resultado.qtdeParcelas < 1 || resultado.qtdeParcelas > MAX_PARCELAS) {
        throw new Error(`O backend retornou uma quantidade de parcelas fora do limite de 1 a ${MAX_PARCELAS}.`)
      }
      if (comprimentos.some((comprimento) => comprimento !== resultado.qtdeParcelas)) {
        throw new Error('O backend retornou dados incompletos para as parcelas.')
      }
      if (dados.periodicidade === 'D' && resultado.qtdeParcelas !== 1) {
        throw new Error('O backend retornou uma quantidade de parcelas diferente de um para vencimento único.')
      }
      if (resultado.qtdeParcelas !== datasVencimento.length
        || resultado.dtVencimento.some((data, indice) => dataBackendParaISO(data) !== datasVencimento[indice])) {
        throw new Error('O backend retornou datas de vencimento diferentes das informadas.')
      }
      setDados((atuais) => ({
        ...atuais,
        valorCredito: atuais.modoValor === 'credito'
          ? atuais.valorCredito
          : numeroBackend(resultado.vlLiberado),
        valorFinanciamento: numeroBackend(resultado.vlFinanciado),
        periodosCarencia: contarPeriodosCarencia(resultado.idCobraPrincipal.map((cobraPrincipal) => cobraPrincipal === 'S')),
      }))
      setResultadoSimulacao(resultado)
      setLimitesParcelas(resultado.vlJuros.map((juros, indice) => ({
        juros: numeroBackend(juros),
        saldoRemanescente: numeroBackend(resultado.vlSdoRemanescente[indice]),
      })))
    } catch (erro: unknown) {
      if (idCalculo === calculoAtual.current) {
        exibirErroCalculo(erro instanceof Error ? erro.message : 'Não foi possível calcular a simulação.')
      }
    } finally {
      if (idCalculo === calculoAtual.current) setCalculando(false)
    }
  }

  function calcularAposEdicao() {
    if (temValorInvalido) return
    if (calculoAposEdicao.current !== null) window.clearTimeout(calculoAposEdicao.current)
    const versao = calculoAtual.current
    calculoAposEdicao.current = window.setTimeout(() => {
      calculoAposEdicao.current = null
      if (calculoAtual.current === versao) void calcular()
    }, 0)
  }

  async function exportarParaExcel() {
    if (!podeExportar) return
    const idCalculo = calculoAtual.current
    let exceljs: typeof import('exceljs')
    try {
      exceljs = await import('exceljs')
    } catch (erro: unknown) {
      setAvisoImpressao(erro instanceof Error ? `Não foi possível carregar a exportação Excel: ${erro.message}` : 'Não foi possível carregar a exportação Excel.')
      return
    }

    const dataReferencia = resultadoSimulacao
      ? dataBackendParaISO(resultadoSimulacao.dtReferencia)
      : dados.dataSimulacao
    const taxaMensal = resultadoSimulacao
      ? resultadoSimulacao.periodicidadeTaxa === 'A'
        ? (Math.pow(1 + resultadoSimulacao.pcTaxaJuros / 100, 1 / 12) - 1) * 100
        : resultadoSimulacao.pcTaxaJuros
      : dados.periodicidadeTaxa === 'A'
        ? (Math.pow(1 + dados.taxaJuros / 100, 1 / 12) - 1) * 100
        : dados.taxaJuros
    const taxaAnual = resultadoSimulacao
      ? resultadoSimulacao.periodicidadeTaxa === 'A'
        ? resultadoSimulacao.pcTaxaJuros
        : (Math.pow(1 + resultadoSimulacao.pcTaxaJuros / 100, 12) - 1) * 100
      : dados.periodicidadeTaxa === 'A'
        ? dados.taxaJuros
        : (Math.pow(1 + dados.taxaJuros / 100, 12) - 1) * 100
    const cet = (Math.pow(1 + taxaMensal / 100, 365 / 30) - 1) * 100
    const workbook = new exceljs.Workbook()
    workbook.creator = 'SMX Corp'

    const resumo = workbook.addWorksheet('Simulação')
    resumo.columns = [
      { width: 34 },
      { width: 24 },
      { width: 16 },
      { width: 14 },
      { width: 18 },
      { width: 20 },
      { width: 20 },
      { width: 16 },
      { width: 21 },
      { width: 20 },
      { width: 22 },
    ]
    resumo.addRow(['Resumo da simulação'])
    resumo.mergeCells('A1:B1')
    resumo.getRow(1).font = { bold: true, size: 14 }
    resumo.addRows([
      ['Data de referência', dataReferencia],
      ['Taxa ao mês', taxaMensal / 100],
      ['Taxa ao ano', taxaAnual / 100],
      ['C.E.T. base 365 ao ano', cet / 100],
      ['Base da taxa', resultadoSimulacao?.baseTaxaJuros ?? dados.baseDias],
      ['Quantidade de parcelas', resultadoSimulacao?.qtdeParcelas ?? parcelasParaAnalise.length],
      ['Valor liberado / valor solicitado', resultadoSimulacao
        ? numeroBackend(resultadoSimulacao.vlLiberado)
        : dados.modoValor === 'credito' ? dados.valorCredito : dados.valorPrimeiraParcela],
      ['Valor financiado', resultadoSimulacao ? numeroBackend(resultadoSimulacao.vlFinanciado) : dados.valorFinanciamento],
      ['IOF calculado', resultadoSimulacao ? numeroBackend(resultadoSimulacao.vlIof) : null],
      ['Sistema de amortização', resultadoSimulacao
        ? ({ 1: 'Price HP', 2: 'Price', 3: 'SAC', 4: 'Especial' }[resultadoSimulacao.sistemaAmortizacao] ?? resultadoSimulacao.sistemaAmortizacao)
        : dados.sistemaAmortizacao],
      ['Periodicidade dos vencimentos', resultadoSimulacao
        ? (isPeriodicidadeVencimento(resultadoSimulacao.periodicidadeVcto) ? periodicidadesVencimento[resultadoSimulacao.periodicidadeVcto] : resultadoSimulacao.periodicidadeVcto)
        : periodicidadesVencimento[dados.periodicidade]],
    ])
    resumo.getColumn(2).alignment = { horizontal: 'right' }
    for (const linha of [3, 4, 5]) {
      resumo.getCell(linha, 2).numFmt = '0.000%'
    }
    for (const linha of [8, 9, 10]) {
      resumo.getCell(linha, 2).numFmt = '"R$" #,##0.00'
    }
    for (const linha of [3, 4, 5, 7, 8, 9, 10]) {
      resumo.getCell(linha, 2).alignment = { horizontal: 'right' }
    }

    resumo.addRow([])
    const linhaTituloParcelas = resumo.addRow(['Parcelas'])
    resumo.mergeCells(`A${linhaTituloParcelas.number}:K${linhaTituloParcelas.number}`)
    linhaTituloParcelas.font = { bold: true, size: 12 }
    const cabecalhoParcelas = resumo.addRow([
      'Parcela',
      'Data de vencimento',
      'Dias corridos',
      'Dias úteis',
      'Dias do período',
      'Valor da parcela',
      'Valor dos juros',
      'Cobrar juros',
      'Valor do principal',
      'Cobrar principal',
      'Saldo remanescente',
    ])
    cabecalhoParcelas.font = { bold: true }
    resumo.addRows(parcelasParaAnalise.map((parcela) => [
      parcela.numero,
      parcela.dataVencimento,
      parcela.diasCorridos,
      parcela.diasUteis ?? '—',
      parcela.diasPeriodo,
      parcela.valorParcela,
      parcela.valorJuros,
      parcela.cobrarJuros === undefined ? '—' : parcela.cobrarJuros ? 'Sim' : 'Não',
      parcela.valorPrincipal,
      parcela.cobrarPrincipal ? 'Sim' : 'Não',
      parcela.saldoRemanescente,
    ]))
    for (const coluna of [1, 3, 4, 5, 6, 7, 9, 11]) {
      resumo.getColumn(coluna).alignment = { horizontal: 'right' }
    }
    for (const coluna of [6, 7, 9, 11]) {
      resumo.getColumn(coluna).numFmt = '"R$" #,##0.00'
    }

    try {
      const conteudo = await workbook.xlsx.writeBuffer()
      if (idCalculo !== calculoAtual.current) {
        setAvisoImpressao('A simulação foi alterada durante a exportação. Calcule novamente para exportar.')
        return
      }
      const arquivo = new Blob([conteudo], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(arquivo)
      const link = document.createElement('a')
      link.href = url
      link.download = `simulacao-${dataReferencia || 'financeira'}.xlsx`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (erro: unknown) {
      setAvisoImpressao(erro instanceof Error ? `Não foi possível exportar para Excel: ${erro.message}` : 'Não foi possível exportar para Excel.')
    }
  }

  function abrirRelatorioPdf() {
    if (!podeExportar) return
    const simuladorAtual = document.querySelector<HTMLElement>('.simulator')
    if (!simuladorAtual) return

    const abaPdf = window.open('', '_blank')
    if (!abaPdf) {
      setAvisoImpressao('Permita a abertura de pop-ups para gerar o PDF em uma nova aba.')
      return
    }

    setAvisoImpressao('')
    const documentoPdf = abaPdf.document
    documentoPdf.documentElement.lang = 'pt-BR'
    documentoPdf.documentElement.dataset.theme = 'claro'
    documentoPdf.title = 'Simulação financeira SMX Corp'

    const metaCharset = documentoPdf.createElement('meta')
    metaCharset.setAttribute('charset', 'utf-8')
    documentoPdf.head.append(metaCharset)

    const metaViewport = documentoPdf.createElement('meta')
    metaViewport.name = 'viewport'
    metaViewport.content = 'width=device-width, initial-scale=1.0'
    documentoPdf.head.append(metaViewport)

    const carregamentosEstilo: Promise<void>[] = []
    document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]').forEach((estilo) => {
      if (estilo instanceof HTMLLinkElement) {
        const copia = estilo.cloneNode(true) as HTMLLinkElement
        copia.href = estilo.href
        carregamentosEstilo.push(new Promise((resolve, reject) => {
          copia.addEventListener('load', () => resolve(), { once: true })
          copia.addEventListener('error', () => reject(new Error('Não foi possível carregar os estilos do relatório.')), { once: true })
        }))
        documentoPdf.head.append(copia)
      } else {
        documentoPdf.head.append(estilo.cloneNode(true))
      }
    })

    const estiloPaginas = documentoPdf.createElement('style')
    estiloPaginas.textContent = `
      @page {
        size: A4 landscape;
        margin: 18mm 10mm 15mm;
        @top-left {
          content: "SMX Corp — Simulação financeira";
          color: #073879;
          font: 600 10pt sans-serif;
        }
        @bottom-left {
          content: "Simulação para fins de planejamento";
          color: #4b5560;
          font: 9pt sans-serif;
        }
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          color: #4b5560;
          font: 9pt sans-serif;
        }
      }
    `
    documentoPdf.head.append(estiloPaginas)

    const raizPdf = documentoPdf.createElement('div')
    raizPdf.id = 'root'

    const relatorioPdf = simuladorAtual.cloneNode(true) as HTMLElement
    const seletoresOriginais = simuladorAtual.querySelectorAll('select')
    relatorioPdf.querySelectorAll('select').forEach((seletor, indice) => {
      Array.from(seletor.options).forEach((opcao, indiceOpcao) => {
        opcao.selected = seletoresOriginais[indice].options[indiceOpcao].selected
      })
    })
    relatorioPdf.querySelector('.actions')?.remove()
    relatorioPdf.querySelector('.theme-toggle')?.remove()
    relatorioPdf.querySelectorAll('.api-status').forEach((status) => status.remove())
    relatorioPdf.querySelectorAll('.insert-installment').forEach((botao) => botao.remove())
    relatorioPdf.querySelectorAll('.delete-installment').forEach((botao) => botao.remove())

    relatorioPdf.querySelector('.customization-panel')?.remove()
    if (!incluirGraficoPdf) relatorioPdf.querySelector('.analysis-panel')?.remove()

    relatorioPdf.classList.add('pdf-report')

    raizPdf.append(relatorioPdf)
    documentoPdf.body.replaceChildren(raizPdf)

    abaPdf.addEventListener('afterprint', () => abaPdf.close(), { once: true })

    void Promise.all(carregamentosEstilo).then(() => {
      abaPdf.requestAnimationFrame(() => {
        abaPdf.requestAnimationFrame(() => {
          if (abaPdf.closed) return
          abaPdf.focus()
          abaPdf.print()
        })
      })
    }).catch((erro: unknown) => {
      abaPdf.close()
      setAvisoImpressao(erro instanceof Error ? erro.message : 'Não foi possível preparar o relatório para impressão.')
    })
  }

  return (
    <main className="simulator relative min-h-screen">
      <Header tema={tema} onTemaChange={setTema} />

      <section className="mb-6 mt-5 flex flex-col gap-5 rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 text-white shadow-xl md:flex-row md:items-end md:justify-between md:p-8" aria-labelledby="simulator-welcome-title">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">SIMULADOR DE CRÉDITO · SMX CORP</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl" id="simulator-welcome-title">Modele cada detalhe da sua operação.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Ajuste valores, taxas e vencimentos para entender o custo e o fluxo das parcelas antes de tomar uma decisão.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100">
          <span className="size-2 rounded-full bg-teal-300" aria-hidden="true" />
          Simulação para planejamento
        </div>
      </section>

      <section className="input-grid" aria-label="Dados da simulação">
        <ValorPrazo dados={dados} valorIof={resultadoSimulacao?.vlIof} disabled={personalizacaoPendente} onChange={atualizarDado} />
        <DefinicaoDatas
          dados={dados}
          disabled={personalizacaoPendente}
          primeiroVencimento={dataExibida}
          diasPrimeiroVencimento={diasPrimeiroVencimento}
          avisoVencimento={avisoVencimentoUnico}
          onChange={atualizarDado}
        />
        <Juros dados={dados} onChange={atualizarDado} totalJuros={totalJuros} disabled={personalizacaoPendente} />
      </section>

      <div className="actions" aria-label="Ações da simulação">
        <button className="button button-secondary" type="button" onClick={limparSimulacao}>
          Limpar
        </button>
        <button className="button button-secondary print-button" type="button" onClick={abrirRelatorioPdf} disabled={!podeExportar}>
          Imprimir / Salvar como PDF
        </button>
        <button className="button button-secondary" type="button" onClick={exportarParaExcel} disabled={!podeExportar}>
          Exportar para Excel
        </button>
        <button className="button button-primary" type="button" onClick={calcular} disabled={calculando || temValorInvalido}>
          {calculando ? 'Calculando...' : 'Calcular'}
        </button>
      </div>
      {calculando && <p className="api-status" role="status">Calculando os valores no backend...</p>}
      {erroBackend && <p className="api-status api-status--error" role="alert">{erroBackend}</p>}
      {avisoImpressao && <p className="print-warning" role="status">{avisoImpressao}</p>}
      <label className="print-option">
        <input type="checkbox" checked={incluirGraficoPdf} onChange={(event) => setIncluirGraficoPdf(event.target.checked)} />
        Incluir gráfico no PDF
      </label>

      <section className="analysis-panel" aria-label="Personalização e gráfico das parcelas">
        <Personalizacao
          parcelas={parcelas}
          limites={limitesParcelas}
          errosValores={errosValores}
          onChange={atualizarParcela}
          onValorEditadoBlur={calcularAposEdicao}
          onRestaurarValor={restaurarValorParcela}
          onInsertAfter={inserirParcelaApos}
          onDelete={excluirParcela}
          onInicializar={inicializarPersonalizacao}
          podeInicializar={!calculando && dados.quantidadeParcelas > 0 && !!dados.dataSimulacao && !!dadosParaCalculo.primeiraDataVencimento}
          canAdd={parcelas.length < MAX_PARCELAS && dados.quantidadeParcelas < MAX_PARCELAS && dados.periodicidade !== 'D'}
          vencimentoUnico={dados.periodicidade === 'D'}
        />
        <Grafico parcelas={parcelasParaAnalise} />
      </section>

      <Resultado parcelas={parcelasParaAnalise} simulacao={resultadoSimulacao} />
    </main>
  )
}