# DS Project QC - instalação, banco e publicação

Exportação preparada em 08/14/2026. Este pacote contém o código-fonte da aplicação, banco/migrations e documentação. Não contém PDFs de clientes, dependências instaladas, builds temporários, chaves de API ou credenciais de publicação.

## 1. Arquitetura atual

- Interface: Next.js App Router + React + TypeScript.
- Build/development server: Vinext + Vite.
- Runtime publicado: Cloudflare Workers, gerenciado por OpenAI Sites.
- Banco: Cloudflare D1/SQLite, binding lógico `DB`.
- Modelagem/migrations: Drizzle ORM e Drizzle Kit.
- Autenticação publicada: Sign in with ChatGPT e headers de identidade fornecidos pela plataforma.
- Armazenamento de PDFs: ainda não implementado; o binding R2 está `null`.
- Motor automático de leitura de PDFs/OpenAI API: ainda não implementado.

## 2. Requisitos locais

- Node.js 22.13 ou superior.
- npm, incluído no Node.js.
- Git é recomendado, mas não é necessário apenas para rodar a aplicação.

Confirme as versões:

```powershell
node --version
npm --version
```

## 3. Instalação

Descompacte o ZIP, abra PowerShell ou Terminal dentro da pasta `ds-project-qc` e execute:

```powershell
npm install
```

O projeto inclui `package-lock.json` e `pnpm-lock.yaml`, mas o procedimento documentado usa npm. Não misture gerenciadores no mesmo ciclo de instalação.

## 4. Variáveis de ambiente

Nenhuma variável de ambiente é obrigatória na versão atual.

- Não existe `OPENAI_API_KEY` no código atual porque o motor inteligente ainda não foi conectado.
- Nunca coloque chaves secretas em componentes React, no Git ou no ZIP.
- Quando a OpenAI API for conectada, `OPENAI_API_KEY` deverá ser configurada somente como segredo do servidor/hospedagem.

## 5. Banco D1 local

O binding local é configurado em `vite.config.ts` com:

- binding: `DB`
- database name: `site-creator-d1`
- estado local: `.wrangler/` (ignorado pelo Git)

Inicialize as tabelas locais uma vez:

```powershell
npm run db:local:init
```

A migration executada é:

```text
drizzle/0000_clean_ben_urich.sql
```

As tabelas atuais são:

- `projects`
- `project_events`

Quando `db/schema.ts` for alterado, gere e revise uma nova migration:

```powershell
npm run db:generate
```

Não altere migrations já aplicadas em produção. Crie uma migration nova.

## 6. Rodar localmente

```powershell
npm run dev
```

Abra o endereço local exibido no terminal, normalmente `http://localhost:3000`.

Limitação de autenticação local:

- A demonstração pública de QC abre normalmente.
- As áreas `Projetos` e `Reports - Admin` dependem dos headers `oai-authenticated-user-*`, fornecidos apenas pela hospedagem com Sign in with ChatGPT.
- Em um navegador local comum essas áreas retornarão 401 até que o desenvolvedor implemente um mock de autenticação exclusivo para desenvolvimento ou teste a versão publicada.
- Nunca aceite headers de identidade enviados pelo navegador em produção.

## 7. Validar antes de publicar

```powershell
npm run build
```

O build precisa gerar `dist/server/index.js`. As migrations e `.openai/hosting.json` são copiadas para `dist/.openai/` durante o build.

O comando abaixo pode ser usado durante uma revisão técnica, mas a base atual ainda possui findings legados de acessibilidade/React que devem ser tratados separadamente:

```powershell
npm run lint
```

## 8. Publicar uma atualização no site existente

O site atual é gerenciado pelo OpenAI Sites. O arquivo `.openai/hosting.json` contém o identificador do projeto existente e o binding D1.

Fluxo recomendado:

1. Edite o código.
2. Execute `npm run build`.
3. Faça commit das alterações no Git.
4. Abra a pasta do projeto no Codex com o plugin Sites disponível.
5. Peça: `Valide e publique esta versão no projeto Sites existente definido em .openai/hosting.json`.
6. O fluxo de Sites obtém uma credencial temporária, envia o commit, empacota `dist/` e migrations, salva uma versão e publica.
7. Confirme que o deployment terminou com sucesso e abra a URL publicada.

O remote Git chamado `sites` é interno à plataforma e exige credenciais temporárias. Ele não deve ser tratado como um repositório público ou compartilhável e não deve receber token salvo na URL ou configuração do Git.

## 9. Publicar fora do OpenAI Sites

Este pacote não está configurado para `wrangler deploy` diretamente em uma conta Cloudflare independente. Para migrar, um desenvolvedor deverá:

1. Criar um Worker e banco D1 na conta Cloudflare de destino.
2. Criar uma configuração Wrangler própria.
3. Aplicar as migrations ao novo banco.
4. Configurar os bindings `ASSETS`, `DB` e `IMAGES` necessários ao Worker.
5. Substituir ou recriar o fluxo de autenticação atualmente fornecido pelo Sites/ChatGPT.
6. Configurar domínio, acesso e segredos no novo ambiente.

A aplicação também não está atualmente conectada à Vercel nem ao Supabase, apesar de essas contas poderem existir separadamente.

## 10. Arquivos principais

- `app/page.tsx`: demonstração e findings do QC.
- `app/ProjectsWorkspace.tsx`: projetos, timeline e comparação de revisões.
- `app/ReportsWorkspace.tsx`: report administrativo e CSV.
- `app/api/`: endpoints de projetos, eventos e reports.
- `app/chatgpt-auth.ts`: leitura segura da identidade publicada.
- `db/schema.ts`: schema D1.
- `drizzle/`: migration SQL.
- `worker/index.ts`: entrada do Cloudflare Worker.
- `vite.config.ts`: Vinext, Worker e bindings locais.
- `.openai/hosting.json`: vínculo com o projeto Sites existente.
- `DS-PROJECT-QC-CODE-AND-FLOWS.txt`: exportação textual consolidada.

## 11. Estado real do produto

Implementado:

- Interface de QC e tasks demonstrativa.
- Projetos e timeline persistentes em D1.
- Identificação de quem registrou cada atividade.
- Report administrativo e exportação CSV.
- Controle de acesso corporativo e administrativo.

Ainda parcial ou futuro:

- Upload real e armazenamento de PDFs.
- OCR/renderização e leitura automática.
- Motor de regras e comparação de folhas.
- Persistência de findings, justificativas e regras aprendidas.
- Comparação automática entre revisões.
- Material List automática.

Consulte `DS-PROJECT-QC-CODE-AND-FLOWS.txt` para o fluxo funcional detalhado e uma cópia consolidada do código.
