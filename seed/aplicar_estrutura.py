# -*- coding: utf-8 -*-
"""
Aplica a estrutura real da Impresilk sobre o que já está no banco.

Idempotente: pode rodar de novo. Gera estrutura.sql com
  - cfg nova (4 macroáreas, 21 setores, 4 linhas de produção)
  - os POPs existentes REPOSICIONADOS no setor real (de/para)
  - as 3 jornadas antigas ganhando linha+setor
  - as 5 jornadas novas que fecham as 4 linhas
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from estrutura import CFG, DE_PARA_SETOR, SETORES        # noqa: E402
from jornadas_linhas import JORNADAS_NOVAS, LINHA_DAS_ANTIGAS  # noqa: E402

sql = lambda o: "$json$" + json.dumps(o, ensure_ascii=False) + "$json$"
linhas = []

# 1) cfg nova — preserva os gestores que já estiverem gravados
linhas.append(
    "update pops_config_global set config = "
    + sql(CFG) + "::jsonb || jsonb_build_object('gestores', coalesce(config->'gestores', '{}'::jsonb)), "
    "atualizado_em = now() where id = true;")

# 2) POPs: reposiciona o setor pelo de/para (o resto do registro fica intacto)
for antigo, novo in DE_PARA_SETOR.items():
    linhas.append(
        "update pops_registros set registro = jsonb_set(registro, '{setor}', "
        + sql(novo) + "::jsonb), atualizado_em = now() "
        "where colecao = 'pops' and registro->>'setor' = " + sql(antigo) + "::jsonb #>> '{}';")

# 3) jornadas antigas: ganham linha e setor
for jid, dados in LINHA_DAS_ANTIGAS.items():
    linhas.append(
        "update pops_registros set registro = registro || " + sql(dados) + "::jsonb, "
        "atualizado_em = now() where colecao = 'jornadas' and id = '" + jid + "';")

# 4) jornadas novas
for j in JORNADAS_NOVAS:
    linhas.append(
        "insert into pops_registros (colecao, id, registro, atualizado_em) values "
        f"('jornadas', '{j['id']}', {sql(j)}::jsonb, now()) "
        "on conflict (colecao, id) do update set registro = excluded.registro, "
        "atualizado_em = now(), apagado = false;")

# 5) rev: o pull dos aparelhos só baixa o que mudou -- sem bump, ninguém vê nada
linhas.append(
    "update pops_meta set valor = jsonb_build_object('rev', extract(epoch from now())::bigint, "
    "'porColecao', jsonb_build_object("
    "  'pops', extract(epoch from now())::bigint, "
    "  'jornadas', extract(epoch from now())::bigint, "
    "  'cfg', extract(epoch from now())::bigint, "
    "  'leituras', coalesce((valor->'porColecao'->>'leituras')::bigint, 0), "
    "  'progresso', coalesce((valor->'porColecao'->>'progresso')::bigint, 0))), "
    "atualizado_em = now() where chave = 'rev';")

with open(os.path.join(AQUI, 'estrutura.sql'), 'w') as f:
    f.write('\n'.join(linhas) + '\n')

print(f"estrutura.sql: {len(SETORES)} setores em {len(CFG['areas'])} áreas, "
      f"{len(CFG['linhas'])} linhas, {len(DE_PARA_SETOR)} de/para de POP, "
      f"{len(JORNADAS_NOVAS)} jornadas novas "
      f"({sum(len(j['etapas']) for j in JORNADAS_NOVAS)} etapas)")
