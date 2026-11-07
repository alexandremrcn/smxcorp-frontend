# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Integração local com o simulador Java

O frontend usa o backend Spring Boot em `http://localhost:8080`. No modo de desenvolvimento, o Vite encaminha `/api/*` para esse endereço.

No terminal do workspace Java, execute:

```powershell
Set-Location C:\Code\Java\mvm2-workspace
mvn -pl mvm2-rest-simulator -am package
java -jar .\mvm2-rest-simulator\target\mvm2-rest-simulator-1.0.0.jar
```

Em outro terminal, na raiz deste projeto, execute `npm run dev` e abra `/simulador`.

A prévia das parcelas é gerada no frontend. O botão **Calcular** envia os dados ao `POST /simulator` e apresenta o resumo e as parcelas retornadas.

A simulação permite de 1 a 380 parcelas, inclusive ao adicionar parcelas na personalização.

Na configuração de datas, **Period. de carência (somente juros)** define quantas parcelas iniciais não cobram principal. Informe de zero até uma parcela a menos que o total; essa configuração utiliza o sistema Especial.

A coluna Principal na personalização é apenas informativa e não permite alterar a cobrança.

Ao selecionar o sistema Especial, as parcelas começam com valor informado zero, tipo `A` e cobrança de principal e juros habilitada. Na personalização, apenas valores editados de parcelas com cobrança de principal são enviados ao cálculo; os demais são enviados como zero.

Para editar o valor de uma parcela, calcule primeiro a simulação. O valor informado deve ser maior ou igual aos juros e menor que o saldo remanescente após essa parcela, conforme o último cálculo. Ao sair do campo editado, o cálculo é acionado automaticamente se os valores forem válidos. O valor da última parcela é calculado automaticamente e não pode ser editado; parcelas inseridas precisam ser calculadas antes de terem seus valores editados. Valores inválidos impedem um novo cálculo.

O botão Inicializar na personalização restaura o cronograma anterior às alterações, incluindo quantidade de parcelas e primeiro vencimento. O resultado é descartado e é necessário calcular novamente.

Impressão/PDF e exportação para Excel ficam disponíveis somente após um cálculo concluído com sucesso. Depois de alterar os dados ou personalizar parcelas, é necessário calcular novamente.

Para gerar o PDF sem o gráfico, desmarque **Incluir gráfico no PDF** antes de imprimir. A opção não altera o gráfico exibido na tela nem a exportação para Excel.

O PDF inclui cabeçalho, rodapé e numeração em todas as páginas. Utilize um navegador atualizado com suporte a caixas de margem CSS para impressão, como o Chrome ou o Edge, e desative os cabeçalhos e rodapés do navegador na janela de impressão para evitar conteúdo duplicado.

A taxa de juros base 360 é informada ao mês ou ao ano. Para trocar o critério, digite diretamente no outro campo, que começa em zero; a entrada anterior é zerada e o critério informado fica destacado. As saídas exibem sempre as taxas equivalentes mensal e anual, que também constam no resumo e na exportação após o cálculo.

As periodicidades de vencimento disponíveis são mensal, bimestral, trimestral, anual e vencimento único. **Vencimento 1ª parcela** permite informar de 1 a 3650 dias corridos a partir da data da simulação ou selecionar a data no calendário; os campos são sincronizados. Exceto no Price HP, o dia base é independente do primeiro vencimento e determina os vencimentos seguintes, respeitando o último dia dos meses mais curtos. O backend gera as datas do cálculo e ajusta os vencimentos para dias úteis quando essa opção está habilitada; no vencimento único, a data ajustada e a respectiva quantidade de dias são exibidas antes do cálculo e podem ultrapassar 3650 dias.

No vencimento único, a quantidade de parcelas é fixada em uma e o sistema de amortização em Price. Para Price HP, mantém-se a regra original do backend: o dia base é o dia da simulação e o primeiro vencimento depende da periodicidade; os campos de vencimento e de dia base não são editáveis.

É possível substituir a URL local configurando `VITE_API_BASE_URL`; quando não definida, o frontend usa `/api`.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
