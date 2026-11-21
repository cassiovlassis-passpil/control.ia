# Finanças Família

Aplicação web familiar para organizar créditos, despesas previstas, assinaturas, parcelas e lançamentos por áudio. Esta implementação substitui os dados de demonstração do protótipo por autenticação Supabase, banco PostgreSQL com políticas RLS e uma função de interpretação de áudio no servidor.

## Recursos

- Painel com filtros por membro, categoria e período; gráficos são calculados dos lançamentos autorizados e atualizados por Realtime.
- Créditos e despesas podem ser lançados para datas futuras.
- Assinaturas recorrentes e compras parceladas guardam uma série e suas ocorrências previstas; não movimentam dinheiro nem conectam a bancos.
- Gravação no navegador pede acesso ao microfone. A transcrição e o lançamento sugerido aparecem para edição; só o botão de confirmação grava o lançamento. O áudio não é salvo no banco.
- Cada família é um espaço compartilhado: membros autenticados podem consultar os dados da família; políticas no banco limitam leituras e operações à família e ao autor apropriado.

## Executar localmente

Requisitos: Node.js 24 LTS e npm 11; projeto Supabase dedicado para este app.

1. Copie `.env.example` para `.env.local` e preencha a URL do projeto e a chave publicável do Supabase.
2. Instale dependências com `npm ci`.
3. Aplique `supabase/migrations/20261121000100_financas_familia_core.sql` somente em um projeto novo dedicado, após revisão. Não aplique em outro banco.
4. Configure Supabase Auth com login por e-mail e confirme os e-mails. A primeira conta cria uma família; convites são restritos ao e-mail verificado.
5. Configure os segredos da função `audio-parse`: `OPENAI_API_KEY`, `APP_ORIGIN`, `OPENAI_TRANSCRIBE_MODEL` e `OPENAI_PARSE_MODEL`. Nenhuma chave de servidor deve começar com `NEXT_PUBLIC_`.
6. Inicie com `npm run dev`; para validar a compilação use `npm run typecheck` e `npm run build`.

Não reutilize chaves ou bancos de outro app. O app não depende de `service_role` no navegador. A função de áudio valida o JWT, a associação à família e o tamanho/tipo do arquivo antes de chamar o provedor.

## Escopo e revisão

O PR permanece em rascunho e não implanta nem altera serviços remotos. Antes de uso real, configure domínio autorizado, e-mail de autenticação, limites de uso/custo da transcrição, política de privacidade/consentimento para envio a provedor externo, retenção e backup do banco, e revise as políticas RLS no projeto novo. Valores de demonstração do protótipo não são importados.

O sistema é um registro manual/planejamento doméstico. Não faz pagamentos, débito automático, conexão bancária ou aconselhamento financeiro.
