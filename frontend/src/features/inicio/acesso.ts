export const PLANO_ACESSO = {
  valorCentavos: 3200,
  duracaoDias: 30,
  formaPagamento: 'PIX',
} as const

export interface CredenciaisLogin {
  email: string
  senha: string
}

export interface CadastroUsuarioPayload extends CredenciaisLogin {
  nomeCompleto: string
  aceitouCondicoes: true
  plano: typeof PLANO_ACESSO
}

export interface SessaoAcesso {
  token: string
  nomeCompleto: string
  validoAte: string
}

export interface CadastroPendente {
  status: 'aguardando-pagamento'
  pixCopiaECola: string
  pagamentoExpiraEm: string
}

export interface ServicoAcesso {
  entrar(credenciais: CredenciaisLogin): Promise<SessaoAcesso>
  cadastrar(dados: CadastroUsuarioPayload): Promise<CadastroPendente>
}
