import { useEffect, useRef, useState } from 'react'
import Header from './components/Header.tsx'
import ValorPrazo from './components/ValorPrazo'
import DefinicaoDatas from './components/DefinicaoDatas'
import Juros from './components/Juros'
import Personalizacao from './components/Personalizacao'
import Grafico from './components/Grafico'
import Resultado from './components/Resultado'
import {
  criarDadosZerados,
  gerarParcelas,
  sugerirDataVencimento,
  type AjusteParcela,
  type DadosSimulacao,
  type Parcela,
} from './model/simulacao'
import {
  calcularSimulacao,
  dataBackendParaISO,
  dataISOParaBackend,
  numeroBackend,
  type ResultadoSimulacao,
  type SolicitarSimulacao,
} from './services/backend'
import './simulador.css'

type Tema = 'claro' | 'escuro'

function periodicidadeBackend(periodicidade: number) {
  if (periodicidade === 2) return 'B'
  if (periodicidade === 3) return 'T'
  return 'M'
}

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
  const pedido: SolicitarSimulacao = {
    vlSolicitado: vlSolicitado.toFixed(2),
    vl1aParcela: vl1aParcela.toFixed(2),
    dtReferencia: dataISOParaBackend(dados.dataSimulacao),
    vlEncargos: dados.valorTarifa.toFixed(2),
    idTaxaFator: 'T',
    taxa: dados.taxaJuros.toString(),
    periodicidadeTaxa: dados.periodicidadeTaxa,
    baseTaxa: String(dados.baseDias),
    periodicidadeVcto: periodicidadeBackend(dados.periodicidade),
    idDiaUtil: dados.diasUteis ? 'S' : 'N',
    tipoJuros: 'S',
    qtdeParcelas: String(parcelas.length),
    qtdeDiasCarencia: String(Math.max(0, dados.diasCarencia)),
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
    pedido.vlParcelaIn = parcelas.map((parcela) => (
      parcela.cobrarPrincipal ? parcela.valorParcela.toFixed(2) : '0.00'
    ))
    pedido.idTipoParcelaIn = parcelas.map((_, indice) => ajustes[indice]?.alterada ? 'A' : 'N')
    pedido.dtVencimento = datasVencimento.map(dataISOParaBackend)
  } else {
    pedido.idCobrJuros = parcelas.map(() => 'S')
    pedido.idCobrPrinc = parcelas.map(() => 'S')
    pedido.vlParcelaIn = parcelas.map(() => '0.00')
    pedido.idTipoParcelaIn = parcelas.map(() => 'A')
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
    || dados.quantidadeParcelas > 380
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

function contarParcelasPrincipal(parcelas: Parcela[], ajustes: AjusteParcela[]) {
  return parcelas.reduce((quantidade, parcela, indice) => {
    const cobrarPrincipal = ajustes[indice]?.cobrarPrincipal ?? parcela.cobrarPrincipal
    return quantidade + (cobrarPrincipal ? 1 : 0)
  }, 0)
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
  const [avisoImpressao, setAvisoImpressao] = useState('')
  const [resultadoSimulacao, setResultadoSimulacao] = useState<ResultadoSimulacao | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [erroBackend, setErroBackend] = useState('')
  const [resultadoDescartado, setResultadoDescartado] = useState(false)
  const [personalizacaoPendente, setPersonalizacaoPendente] = useState(false)
  const calculoAtual = useRef(0)
  const sistemaAmortizacaoAntesPersonalizacao = useRef<DadosSimulacao['sistemaAmortizacao']>('Price')
  const parcelasEmPrevia = parcelasPrevistas(dados, ajustes)
  const manterPreviaNoErro = erroBackend !== '' && dados.sistemaAmortizacao === 'Especial'
  const parcelas = resultadoDescartado || (erroBackend && !manterPreviaNoErro)
    ? []
    : resultadoSimulacao
      ? parcelasDaSimulacao(resultadoSimulacao)
      : parcelasEmPrevia
  const parcelasParaAnalise = personalizacaoPendente ? [] : parcelas
  const totalJuros = parcelas.reduce((total, parcela) => total + parcela.valorJuros, 0)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    localStorage.setItem('smxcorp-tema', tema)
  }, [tema])

  useEffect(() => {
    document.title = 'Simulador financeiro | SMX Corp'
  }, [])

  function atualizarDado<K extends keyof DadosSimulacao>(campo: K, valor: DadosSimulacao[K]) {
    // Alterar uma entrada após o cálculo invalida resultado, gráfico e fluxo de vencimentos.
    const havia = resultadoSimulacao !== null
    const estavaNoFluxoEspecial = dados.sistemaAmortizacao === 'Especial'
    if (havia) setResultadoDescartado(true)

    if (campo === 'qtdeParcelasPrincipal' && typeof valor === 'number' && !estavaNoFluxoEspecial) {
      const quantidadeValida = Math.max(1, Math.min(dados.quantidadeParcelas, Math.floor(valor) || 1))
      const primeirosIndiceDesmarcado = Math.max(0, parcelas.length - quantidadeValida)
      const novosAjustes = parcelas.map((parcela, indice) => ({
        ...ajustes[indice],
        dataVencimento: parcela.dataVencimento,
        cobrarPrincipal: indice >= primeirosIndiceDesmarcado,
        alterada: true,
      }))

      calculoAtual.current += 1
      setResultadoSimulacao(null)
      setCalculando(false)
      setErroBackend('')
      setAjustes(novosAjustes)
      setDados((atuais) => {
        if (atuais.sistemaAmortizacao !== 'Especial') {
          sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
        }
        return {
          ...atuais,
          qtdeParcelasPrincipal: quantidadeValida,
          sistemaAmortizacao: 'Especial',
        }
      })
      return
    }

    if (estavaNoFluxoEspecial) {
      sistemaAmortizacaoAntesPersonalizacao.current = 'Price'
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

      if (campo === 'quantidadeParcelas' && typeof valor === 'number') {
        atualizados.qtdeParcelasPrincipal = Math.max(0, Math.min(380, Math.floor(valor) || 0))
      }

      if (campo === 'qtdeParcelasPrincipal' && typeof valor === 'number' && estavaNoFluxoEspecial) {
        atualizados.qtdeParcelasPrincipal = Math.max(1, Math.min(atuais.quantidadeParcelas, Math.floor(valor) || 1))
      }

      if (!estavaNoFluxoEspecial && campo === 'sistemaAmortizacao' && valor === 'Price HP') {
        atualizados.diasUteis = false
        atualizados.primeiraDataVencimento = proximoMes(atuais.dataSimulacao)
      }

      if (campo === 'dataSimulacao' && typeof valor === 'string' && valor) {
        const dia = Number(valor.slice(-2))
        atualizados.diaBaseVencimento = dia
        atualizados.primeiraDataVencimento = proximoMes(valor)
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

      if (estavaNoFluxoEspecial) {
        atualizados.sistemaAmortizacao = 'Price'
        atualizados.diasCarencia = 0
      }

      return atualizados
    })
  }

  function atualizarParcela(indice: number, ajuste: AjusteParcela) {
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
      alterada: novosAjustes[indice]?.alterada || valorFoiAlterado,
    }
    setAjustes(novosAjustes)
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        sistemaAmortizacao: 'Especial',
        qtdeParcelasPrincipal: ajuste.cobrarPrincipal !== undefined
          ? contarParcelasPrincipal(parcelas, novosAjustes)
          : atuais.qtdeParcelasPrincipal,
        ...(indice === 0 && ajuste.dataVencimento
          ? {
              primeiraDataVencimento: ajuste.dataVencimento,
              diaBaseVencimento: Number(ajuste.dataVencimento.slice(-2)),
            }
          : {}),
      }
    })
  }

  function atualizarTodasParcelas(cobrarPrincipal: boolean) {
    setPersonalizacaoPendente(true)
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')
    setAjustes((atuais) => Array.from({ length: parcelas.length }, (_, indice) => {
      const cobrar = indice === parcelas.length - 1 || cobrarPrincipal
      return {
        ...atuais[indice],
        cobrarPrincipal: cobrar,
      }
    }))
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        sistemaAmortizacao: 'Especial',
        qtdeParcelasPrincipal: cobrarPrincipal ? parcelas.length : 1,
      }
    })
  }

  function inserirParcelaApos(indice: number) {
    if (parcelas.length >= 380) return
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')

    const novaData = sugerirDataVencimento(
      parcelas[indice].dataVencimento,
      parcelas[indice + 1]?.dataVencimento,
      dados.periodicidade,
    )
    if (
      novaData <= parcelas[indice].dataVencimento
      || (parcelas[indice + 1] && novaData >= parcelas[indice + 1].dataVencimento)
    ) {
      return
    }
    setPersonalizacaoPendente(true)
    const novosAjustes = parcelas.map((parcela, indiceParcela) => ({
      ...ajustes[indiceParcela],
      dataVencimento: parcela.dataVencimento,
    }))

    novosAjustes.splice(indice + 1, 0, {
      dataVencimento: novaData,
      valorParcela: 0,
      cobrarPrincipal: true,
      alterada: true,
    })

    setAjustes(novosAjustes)
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        quantidadeParcelas: atuais.quantidadeParcelas + 1,
        sistemaAmortizacao: 'Especial',
      }
    })
  }

  function excluirParcela(indice: number) {
    if (parcelas.length <= 1) return
    setPersonalizacaoPendente(true)
    calculoAtual.current += 1
    setResultadoSimulacao(null)
    setCalculando(false)
    setErroBackend('')

    const novosAjustes = parcelas.map((parcela, indiceParcela) => ({
      ...ajustes[indiceParcela],
      dataVencimento: parcela.dataVencimento,
      valorParcela: parcela.valorParcela,
      cobrarPrincipal: parcela.cobrarPrincipal,
    }))
    novosAjustes.splice(indice, 1)
    const ultimoAjuste = novosAjustes[novosAjustes.length - 1]
    if (ultimoAjuste && !ultimoAjuste.cobrarPrincipal) {
      novosAjustes[novosAjustes.length - 1] = {
        ...ultimoAjuste,
        cobrarPrincipal: true,
      }
    }

    setAjustes(novosAjustes)
    setDados((atuais) => {
      if (atuais.sistemaAmortizacao !== 'Especial') {
        sistemaAmortizacaoAntesPersonalizacao.current = atuais.sistemaAmortizacao
      }
      return {
        ...atuais,
        quantidadeParcelas: atuais.quantidadeParcelas - 1,
        sistemaAmortizacao: 'Especial',
      }
    })
  }

  function limparSimulacao() {
    calculoAtual.current += 1
    sistemaAmortizacaoAntesPersonalizacao.current = 'Price'
    setPersonalizacaoPendente(false)
    setDados(criarDadosZerados())
    setAjustes([])
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
    if (
      !dados.dataSimulacao
      || !dados.primeiraDataVencimento
      || !Number.isInteger(dados.quantidadeParcelas)
      || dados.quantidadeParcelas < 1
      || dados.quantidadeParcelas > 380
      || !Number.isFinite(dados.modoValor === 'credito' ? dados.valorCredito : dados.valorPrimeiraParcela)
      || (dados.modoValor === 'credito' ? dados.valorCredito : dados.valorPrimeiraParcela) <= 0
      || !Number.isFinite(dados.taxaJuros)
      || dados.taxaJuros < 0
    ) {
      exibirErroCalculo('Preencha as datas, informe um valor solicitado ou valor da 1ª parcela maior que zero e uma quantidade válida de parcelas (1 a 380).')
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
      const parcelasReferencia = gerarParcelas(dados, ajustes)
      const datasVencimento = parcelasReferencia.map((parcela, indice) => (
        ajustes[indice]?.dataVencimento ?? parcela.dataVencimento
      ))
      let vlSolicitado = dados.modoValor === 'credito' ? dados.valorCredito : 0
      let vl1aParcela = dados.modoValor === 'primeiraParcela' ? dados.valorPrimeiraParcela : 0

      if (dados.sistemaAmortizacao === 'Especial' && dados.modoValor === 'primeiraParcela') {
        const pedidoValorPresente = montarPedidoSimulacao(
          dados,
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
      const parcelasBase = gerarParcelas({ ...dados, valorFinanciamento: valorBaseParcelas }, ajustes)
      const pedido = montarPedidoSimulacao(
        dados,
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
      if (comprimentos.some((comprimento) => comprimento !== resultado.qtdeParcelas)) {
        throw new Error('O backend retornou dados incompletos para as parcelas.')
      }
      const quantidadeParcelasPrincipal = resultado.idCobraPrincipal.filter((cobraPrincipal) => cobraPrincipal === 'S').length
      setDados((atuais) => ({
        ...atuais,
        valorCredito: atuais.modoValor === 'credito'
          ? atuais.valorCredito
          : numeroBackend(resultado.vlLiberado),
        valorFinanciamento: numeroBackend(resultado.vlFinanciado),
        qtdeParcelasPrincipal: quantidadeParcelasPrincipal,
      }))
      setResultadoSimulacao(resultado)
    } catch (erro: unknown) {
      if (idCalculo === calculoAtual.current) {
        exibirErroCalculo(erro instanceof Error ? erro.message : 'Não foi possível calcular a simulação.')
      }
    } finally {
      if (idCalculo === calculoAtual.current) setCalculando(false)
    }
  }

  async function exportarParaExcel() {
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
        ? ({ M: 'Mensal', B: 'Bimestral', T: 'Trimestral', A: 'Anual', D: 'Diária' }[resultadoSimulacao.periodicidadeVcto] ?? resultadoSimulacao.periodicidadeVcto)
        : ({ 1: 'Mensal', 2: 'Bimestral', 3: 'Trimestral' }[dados.periodicidade] ?? dados.periodicidade)],
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

    const metaViewport = documentoPdf.createElement('meta')
    metaViewport.name = 'viewport'
    metaViewport.content = 'width=device-width, initial-scale=1.0'
    documentoPdf.head.append(metaViewport)

    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((estilo) => {
      documentoPdf.head.append(estilo.cloneNode(true))
    })

    const raizPdf = documentoPdf.createElement('div')
    raizPdf.id = 'root'

    const relatorioPdf = simuladorAtual.cloneNode(true) as HTMLElement
    relatorioPdf.querySelector('.actions')?.remove()
    relatorioPdf.querySelector('.theme-toggle')?.remove()
    relatorioPdf.querySelectorAll('.api-status').forEach((status) => status.remove())
    relatorioPdf.querySelectorAll('.insert-installment').forEach((botao) => botao.remove())
    relatorioPdf.querySelectorAll('.delete-installment').forEach((botao) => botao.remove())

    relatorioPdf.querySelector('.customization-panel')?.remove()

    relatorioPdf.classList.add('pdf-report')

    raizPdf.append(relatorioPdf)
    documentoPdf.body.replaceChildren(raizPdf)

    abaPdf.addEventListener('afterprint', () => abaPdf.close(), { once: true })

    abaPdf.requestAnimationFrame(() => {
      abaPdf.requestAnimationFrame(() => {
        if (abaPdf.closed) return
        abaPdf.focus()
        abaPdf.print()
      })
    })
  }

  return (
    <main className="simulator">
      <Header tema={tema} onTemaChange={setTema} />

      <section className="input-grid" aria-label="Dados da simulação">
        <ValorPrazo dados={dados} valorIof={resultadoSimulacao?.vlIof} disabled={personalizacaoPendente} onChange={atualizarDado} />
        <DefinicaoDatas dados={dados} disabled={personalizacaoPendente} onChange={atualizarDado} />
        <Juros dados={dados} onChange={atualizarDado} totalJuros={totalJuros} disabled={personalizacaoPendente} />
      </section>

      <div className="actions" aria-label="Ações da simulação">
        <button className="button button-secondary" type="button" onClick={limparSimulacao}>
          Limpar
        </button>
        <button className="button button-secondary print-button" type="button" onClick={abrirRelatorioPdf}>
          Imprimir / Salvar como PDF
        </button>
        <button className="button button-secondary" type="button" onClick={exportarParaExcel} disabled={parcelasParaAnalise.length === 0}>
          Exportar para Excel
        </button>
        <button className="button button-primary" type="button" onClick={calcular} disabled={calculando}>
          {calculando ? 'Calculando...' : 'Calcular'}
        </button>
      </div>
      {calculando && <p className="api-status" role="status">Calculando os valores no backend...</p>}
      {erroBackend && <p className="api-status api-status--error" role="alert">{erroBackend}</p>}
      {avisoImpressao && <p className="print-warning" role="status">{avisoImpressao}</p>}

      <section className="analysis-panel" aria-label="Personalização e gráfico das parcelas">
        <Personalizacao
          parcelas={parcelas}
          onChange={atualizarParcela}
          onToggleAll={atualizarTodasParcelas}
          onInsertAfter={inserirParcelaApos}
          onDelete={excluirParcela}
          canAdd={parcelas.length < 380}
        />
        <Grafico parcelas={parcelasParaAnalise} />
      </section>

      <Resultado parcelas={parcelasParaAnalise} simulacao={resultadoSimulacao} />
    </main>
  )
}