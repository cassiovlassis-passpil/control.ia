# FinanÃ§as FamÃ­lia

AplicaÃ§Ã£o web familiar para organizar crÃ©ditos, despesas previstas, assinaturas, parcelas e lanÃ§amentos por Ã¡udio. Esta implementaÃ§Ã£o substitui os dados de demonstraÃ§Ã£o do protÃ³tipo por autenticaÃ§Ã£o Supabase, banco PostgreSQL com polÃ­ticas RLS e uma funÃ§Ã£o de interpretaÃ§Ã£o de Ã¡udio no servidor.

## Recursos

- Painel com filtros por membro, categoria e perÃ­odo; grÃ¡ficos sÃ£o calculados dos lanÃ§amentos autorizados e atualizados por Realtime.
- CrÃ©ditos e despesas podem ser lanÃ§ados para datas futuras.
- Assinaturas recorrentes e compras parceladas guardam uma sÃ©rie e suas ocorrÃªncias previstas; nÃ£o movimentam dinheiro nem conectam a bancos.
- GravaÃ§Ã£o no navegador pede acesso ao microfone. A transcriÃ§Ã£o e o lanÃ§amento sugerido aparecem para ediÃ§Ã£o; sÃ³ o botÃ£o de confirmaÃ§Ã£o grava o lanÃ§amento. O Ã¡udio nÃ£o Ã© salvo no banco.
- Cada famÃ­lia Ã© um espaÃ§o compartilhado: membros autenticados podem consultar os dados da famÃ­lia; polÃ­ticas no banco limitam leituras e operaÃ§Ãµes Ã  famÃ­lia e ao autor apropriado.

## Executar localmente

Requisitos: Node.js 24 LTS e npm 11; projeto Supabase dedicado para este app.

1. Copie `.env.example` para `.env.local` e preencha a URL do projeto e a chave publicÃ¡vel do Supabase.
2. Instale dependÃªncias com `npm ci`.
3. Aplique `supabase/migrations/20261121000100_financas_familia_core.sql` somente em um projeto novo dedicado, apÃ³s revisÃ£o. NÃ£o aplique em outro banco.
4. Configure Supabase Auth com login por e-mail e confirme os e-mails. A primeira conta cria uma famÃ­lia; convites sÃ£o restritos ao e-mail verificado.
5. Configure os segredos da funÃ§Ã£o `audio-parse`: `OPENAI_API_KEY`, `APP_ORIGIN`, `OPENAI_TRANSCRIBE_MODEL` e `OPENAI_MODEL`. Nenhuma chave de servidor deve comeÃ§ar com `NEXT_PUBLIC_`.
6. Inicie com `npm run dev`; para validar a compilaÃ§Ã£o use `npm run typecheck` e `npm run build`.

NÃ£o reutilize chaves ou bancos de outro app. O app nÃ£o depende de `service_role` no navegador. A funÃ§Ã£o de Ã¡udio valida o JWT, a associaÃ§Ã£o Ã  famÃ­lia e o tamanho/tipo do arquivo antes de chamar o provedor.

## Escopo e revisÃ£o

O PR permanece em rascunho e nÃ£o implanta nem altera serviÃ§os remotos. Antes de uso real, configure domÃ­nio autorizado, e-mail de autenticaÃ§Ã£o, limites de uso/custo da transcriÃ§Ã£o, polÃ­tica de privacidade/consentimento para envio a provedor externo, retenÃ§Ã£o e backup do banco, e revise as polÃ­ticas RLS no projeto novo. Valores de demonstraÃ§Ã£o do protÃ³tipo nÃ£o sÃ£o importados.

O sistema Ã© um registro manual/planejamento domÃ©stico. NÃ£o faz pagamentos, dÃ©bito automÃ¡tico, conexÃ£o bancÃ¡ria ou aconselhamento financeiro.

