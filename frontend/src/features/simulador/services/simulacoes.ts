import type { AjusteParcela, DadosSimulacao } from '../model/simulacao'

export interface SalvarSimulacaoInput {
  dados: DadosSimulacao
  ajustes: AjusteParcela[]
}

export interface SimulacaoPersistida extends SalvarSimulacaoInput {
  id: string
  criadaEm: string
  atualizadaEm: string
}

export interface ServicoSimulacoes {
  criar(dados: SalvarSimulacaoInput): Promise<SimulacaoPersistida>
  atualizar(id: string, dados: SalvarSimulacaoInput): Promise<SimulacaoPersistida>
  consultar(id: string): Promise<SimulacaoPersistida | null>
  listarDoUsuario(usuarioId: string): Promise<SimulacaoPersistida[]>
}

export type ModalidadeCredito =
  | 'credito-pessoal'
  | 'consignado'
  | 'capital-de-giro'
  | 'financiamento-veiculo'
  | 'credito-com-garantia'

export interface SolicitarCalculoIof {
  modalidade: ModalidadeCredito
  valorFinanciado: number
  prazoDias: number
  dataContratacao: string
}

export interface ResultadoCalculoIof {
  valorIof: number
  regraAplicada: string
  calculadoEm: string
}

export interface ServicoIof {
  calcular(entrada: SolicitarCalculoIof): Promise<ResultadoCalculoIof>
}
