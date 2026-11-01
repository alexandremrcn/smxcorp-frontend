export interface SolicitarSimulacao {
  vlSolicitado: string
  vl1aParcela: string
  dtReferencia: string
  vlEncargos: string
  idTaxaFator: string
  taxa: string
  periodicidadeTaxa: string
  baseTaxa: string
  periodicidadeVcto: string
  idDiaUtil: string
  tipoJuros: string
  qtdeParcelas: string
  qtdeDiasCarencia: string
  diaBaseVencimento: string
  cdSistemaAmortizacao: string
  tpNegociacaoIof: string
  idIofEmbutido: string
  pcAliquotaIOF: string
  pcAliquotaAdicional: string
  idCobrJuros?: string[]
  idCobrPrinc?: string[]
  vlParcelaIn?: string[]
  idTipoParcelaIn?: string[]
  dtVencimento?: string[]
}

export interface ResultadoSimulacao {
  cdResult: number
  msgResult: string
  dtReferencia: string
  pcTaxaJuros: number
  periodicidadeTaxa: string
  baseTaxaJuros: number
  qtdeParcelas: number
  vlLiberado: string
  vlFinanciado: string
  vlIof: string
  sistemaAmortizacao: number
  periodicidadeVcto: string
  tpJuros: string
  vl1aParela: string
  numParcela: number[]
  dtVencimento: string[]
  qtdeDiasCorr: number[]
  qtdeDiasUteis: number[]
  idCobraJuros: string[]
  idCobraPrincipal: string[]
  vlParcela: string[]
  vlJuros: string[]
  vlPrincipal: string[]
  vlSdoRemanescente: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

function isResultadoSimulacao(value: unknown): value is ResultadoSimulacao {
  if (!isRecord(value) || !isNumber(value.cdResult) || !isString(value.msgResult)) return false
  if (value.cdResult !== 0) return true

  return isString(value.dtReferencia)
    && isNumber(value.pcTaxaJuros)
    && isString(value.periodicidadeTaxa)
    && isNumber(value.baseTaxaJuros)
    && isNumber(value.qtdeParcelas)
    && (value.vlLiberado === undefined || value.vlLiberado === null || isString(value.vlLiberado))
    && isString(value.vlFinanciado)
    && isString(value.vlIof)
    && isNumber(value.sistemaAmortizacao)
    && isString(value.periodicidadeVcto)
    && isString(value.tpJuros)
    && isString(value.vl1aParela)
    && isNumberArray(value.numParcela)
    && isStringArray(value.dtVencimento)
    && isNumberArray(value.qtdeDiasCorr)
    && isNumberArray(value.qtdeDiasUteis)
    && isStringArray(value.idCobraJuros)
    && isStringArray(value.idCobraPrincipal)
    && isStringArray(value.vlParcela)
    && isStringArray(value.vlJuros)
    && isStringArray(value.vlPrincipal)
    && isStringArray(value.vlSdoRemanescente)
}

function mensagemErro(response: unknown, status: number) {
  if (isRecord(response)) {
    if (typeof response.message === 'string') return response.message
    if (typeof response.msgResult === 'string') return response.msgResult
  }
  return `O backend respondeu com HTTP ${status}.`
}

async function requisitar<T>(
  rota: string,
  opcoes: RequestInit,
  validar: (resposta: unknown) => resposta is T,
): Promise<T> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const resposta = await fetch(`${baseUrl}${rota}`, opcoes)
  const conteudo: unknown = await resposta.json()

  if (!resposta.ok) {
    throw new Error(mensagemErro(conteudo, resposta.status))
  }
  if (!validar(conteudo)) {
    throw new Error('O backend retornou um formato de resposta inesperado.')
  }
  return conteudo
}

export async function calcularSimulacao(input: SolicitarSimulacao) {
  const resultado = await requisitar('/simulator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, isResultadoSimulacao)

  // O backend devolve vlLiberado nulo: valor solicitado = financiado - IOF - encargos.
  if (resultado.cdResult === 0) {
    resultado.vlLiberado = (
      numeroBackend(resultado.vlFinanciado)
      - numeroBackend(resultado.vlIof)
      - numeroBackend(input.vlEncargos)
    ).toFixed(2)
  }
  return resultado
}

export function dataBackendParaISO(data: string) {
  if (/^\d{8}$/.test(data)) {
    return `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`
  }
  return data
}

export function dataISOParaBackend(data: string) {
  return data.replaceAll('-', '')
}

export function numeroBackend(valor: string) {
  const normalizado = valor.includes(',')
    ? valor.replaceAll('.', '').replace(',', '.')
    : valor
  return Number(normalizado)
}
