export interface DadosSimulacao {
  sistemaAmortizacao: 'Price' | 'Price HP' | 'SAC' | 'Especial'
  modoValor: 'credito' | 'primeiraParcela'
  valorCredito: number
  valorPrimeiraParcela: number
  valorTarifa: number
  valorFinanciamento: number
  quantidadeParcelas: number
  dataSimulacao: string
  diaBaseVencimento: number
  primeiraDataVencimento: string
  periodicidade: number
  diasUteis: boolean
  qtdeParcelasPrincipal: number
  diasCarencia: number
  taxaJuros: number
  periodicidadeTaxa: 'M' | 'A'
  baseDias: 360
}

export interface AjusteParcela {
  dataVencimento?: string
  valorParcela?: number
  cobrarPrincipal?: boolean
  alterada?: boolean
}

export interface Parcela {
  numero: number
  dataVencimento: string
  diasCorridos: number
  diasPeriodo: number
  diasUteis?: number
  valorParcela: number
  cobrarPrincipal: boolean
  cobrarJuros?: boolean
  valorJuros: number
  valorPrincipal: number
  saldoRemanescente: number
}

function dataLocal(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function adicionarMeses(dataISO: string, meses: number) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const primeiroDia = new Date(ano, mes - 1 + meses, 1)
  const ultimoDia = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth() + 1, 0).getDate()
  primeiroDia.setDate(Math.min(dia, ultimoDia))
  return dataLocal(primeiroDia)
}

function diferencaEmDias(inicio: string, fim: string) {
  const [anoInicio, mesInicio, diaInicio] = inicio.split('-').map(Number)
  const [anoFim, mesFim, diaFim] = fim.split('-').map(Number)
  const inicioUTC = Date.UTC(anoInicio, mesInicio - 1, diaInicio)
  const fimUTC = Date.UTC(anoFim, mesFim - 1, diaFim)
  return Math.max(0, Math.round((fimUTC - inicioUTC) / 86_400_000))
}

export function criarDadosIniciais(): DadosSimulacao {
  const hoje = new Date()
  const proximoVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10)

  return {
    sistemaAmortizacao: 'Price',
    modoValor: 'credito',
    valorCredito: 30000,
    valorPrimeiraParcela: 0,
    valorTarifa: 0,
    valorFinanciamento: 30000,
    quantidadeParcelas: 36,
    dataSimulacao: dataLocal(hoje),
    diaBaseVencimento: hoje.getDate(),
    primeiraDataVencimento: dataLocal(proximoVencimento),
    periodicidade: 1,
    diasUteis: false,
    qtdeParcelasPrincipal: 36,
    diasCarencia: 0,
    taxaJuros: 1,
    periodicidadeTaxa: 'M',
    baseDias: 360,
  }
}

export function criarDadosZerados(): DadosSimulacao {
  const hoje = new Date()
  const dataSimulacao = dataLocal(hoje)
  const primeiroMesVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const ultimoDiaVencimento = new Date(
    primeiroMesVencimento.getFullYear(),
    primeiroMesVencimento.getMonth() + 1,
    0,
  ).getDate()
  const primeiroVencimento = new Date(
    primeiroMesVencimento.getFullYear(),
    primeiroMesVencimento.getMonth(),
    Math.min(hoje.getDate(), ultimoDiaVencimento),
  )

  return {
    sistemaAmortizacao: 'Price',
    modoValor: 'credito',
    valorCredito: 0,
    valorPrimeiraParcela: 0,
    valorTarifa: 0,
    valorFinanciamento: 0,
    quantidadeParcelas: 0,
    dataSimulacao,
    diaBaseVencimento: hoje.getDate(),
    primeiraDataVencimento: dataLocal(primeiroVencimento),
    periodicidade: 1,
    diasUteis: false,
    qtdeParcelasPrincipal: 0,
    diasCarencia: 0,
    taxaJuros: 0,
    periodicidadeTaxa: 'M',
    baseDias: 360,
  }
}

export function taxaMensalBase360(dados: Pick<DadosSimulacao, 'taxaJuros' | 'periodicidadeTaxa'>) {
  const taxa = Math.max(0, dados.taxaJuros) / 100
  return dados.periodicidadeTaxa === 'A' ? Math.pow(1 + taxa, 1 / 12) - 1 : taxa
}

export function gerarParcelas(dados: DadosSimulacao, ajustes: AjusteParcela[] = []): Parcela[] {
  const quantidade = Math.max(1, Math.min(380, Math.floor(dados.quantidadeParcelas) || 1))
  const taxaMensal = taxaMensalBase360(dados)
  const mesesPorPeriodo = Math.max(1, dados.periodicidade)
  const taxaPeriodo = Math.pow(1 + taxaMensal, mesesPorPeriodo) - 1
  const valorFinanciado = Math.max(0, dados.valorFinanciamento)
  const valorBase = taxaPeriodo === 0
    ? valorFinanciado / quantidade
    : valorFinanciado * taxaPeriodo / (1 - Math.pow(1 + taxaPeriodo, -quantidade))

  let saldo = valorFinanciado
  let dataAnterior = dados.dataSimulacao

  return Array.from({ length: quantidade }, (_, indice) => {
    const ajuste = ajustes[indice]
    const dataPadrao = adicionarMeses(dados.primeiraDataVencimento, indice * mesesPorPeriodo)
    const dataVencimento = ajuste?.dataVencimento || dataPadrao
    const diasPeriodo = diferencaEmDias(dataAnterior, dataVencimento)
    const diasCorridos = diferencaEmDias(dados.dataSimulacao, dataVencimento)
    const taxaDoPeriodo = dados.diasUteis
      ? Math.pow(1 + taxaMensal, diasPeriodo / 30) - 1
      : taxaPeriodo
    const valorJuros = saldo * taxaDoPeriodo
    const cobrarPrincipal = indice === quantidade - 1 || (ajuste?.cobrarPrincipal ?? true)
    const valorNatural = indice === quantidade - 1 ? saldo + valorJuros : valorBase
    const valorParcela = Math.max(0, ajuste?.valorParcela ?? valorNatural)
    const valorPrincipal = cobrarPrincipal
      ? Math.min(saldo, Math.max(0, valorParcela - valorJuros))
      : 0

    saldo = Math.max(0, saldo - valorPrincipal)
    dataAnterior = dataVencimento

    return {
      numero: indice + 1,
      dataVencimento,
      diasCorridos,
      diasPeriodo,
      valorParcela,
      cobrarPrincipal,
      valorJuros,
      valorPrincipal,
      saldoRemanescente: saldo,
    }
  })
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function formatarNumero(valor: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor)
}

export function sugerirDataVencimento(dataAnterior: string, proximaData?: string, meses = 1) {
  const [anoAnterior, mesAnterior, diaAnterior] = dataAnterior.split('-').map(Number)
  const dataAnteriorUTC = Date.UTC(anoAnterior, mesAnterior - 1, diaAnterior)
  let novaDataUTC: number

  if (proximaData) {
    const [anoProximo, mesProximo, diaProximo] = proximaData.split('-').map(Number)
    const proximaDataUTC = Date.UTC(anoProximo, mesProximo - 1, diaProximo)
    const intervaloDias = Math.floor((proximaDataUTC - dataAnteriorUTC) / 86_400_000)
    novaDataUTC = dataAnteriorUTC + Math.max(1, Math.floor(intervaloDias / 2)) * 86_400_000
  } else {
    const sugerida = adicionarMeses(dataAnterior, meses)
    const [ano, mes, dia] = sugerida.split('-').map(Number)
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const novaData = new Date(novaDataUTC)
  return `${novaData.getUTCFullYear()}-${String(novaData.getUTCMonth() + 1).padStart(2, '0')}-${String(novaData.getUTCDate()).padStart(2, '0')}`
}