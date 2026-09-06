-- Executar após publicar o filtro de leitura de pops-sync.
-- Invalida os quatro caches pessoais para baixar novamente o escopo permitido.
-- Não altera procedimentos, pessoas, históricos ou atribuições.
update public.pops_meta set valor=jsonb_build_object(
  'rev',coalesce((valor->>'rev')::bigint,0)+1,
  'porColecao',coalesce(valor->'porColecao','{}'::jsonb) ||
    jsonb_build_object(
      'pessoas',coalesce((valor->>'rev')::bigint,0)+1,
      'atribuicoes',coalesce((valor->>'rev')::bigint,0)+1,
      'leituras',coalesce((valor->>'rev')::bigint,0)+1,
      'progresso',coalesce((valor->>'rev')::bigint,0)+1)
),atualizado_em=clock_timestamp() where chave='rev';
