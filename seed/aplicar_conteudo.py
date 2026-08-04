# -*- coding: utf-8 -*-
"""
Insere o conteúdo dos setores que estavam em branco.
Idempotente (upsert por id). Gera conteudo.sql.
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from estrutura import SETORES                                   # noqa: E402
from pops_operacoes import POPS_OPERACOES                        # noqa: E402
from pops_apoio import POPS_APOIO, JORNADAS_FECHAMENTO           # noqa: E402

TODOS_POPS = POPS_OPERACOES + POPS_APOIO

# Trava de segurança: POP em setor que não existe na estrutura fica órfão —
# não aparece em nenhuma aba e ninguém entende por quê.
erros = [p["codigo"] for p in TODOS_POPS if p["setor"] not in SETORES]
if erros:
    raise SystemExit("POP em setor inexistente: " + ", ".join(erros))

sql = lambda o: "$json$" + json.dumps(o, ensure_ascii=False) + "$json$"
linhas = []

for p in TODOS_POPS:
    linhas.append(
        "insert into pops_registros (colecao, id, registro, atualizado_em) values "
        f"('pops', '{p['id']}', {sql(p)}::jsonb, now()) "
        "on conflict (colecao, id) do update set registro = excluded.registro, "
        "atualizado_em = now(), apagado = false;")

for j in JORNADAS_FECHAMENTO:
    linhas.append(
        "insert into pops_registros (colecao, id, registro, atualizado_em) values "
        f"('jornadas', '{j['id']}', {sql(j)}::jsonb, now()) "
        "on conflict (colecao, id) do update set registro = excluded.registro, "
        "atualizado_em = now(), apagado = false;")

# sem bump do rev, nenhum aparelho baixa o conteúdo novo
linhas.append(
    "update pops_meta set valor = jsonb_set(jsonb_set(valor, '{porColecao,pops}', "
    "to_jsonb(extract(epoch from now())::bigint)), '{porColecao,jornadas}', "
    "to_jsonb(extract(epoch from now())::bigint)), atualizado_em = now() where chave = 'rev';")

with open(os.path.join(AQUI, 'conteudo.sql'), 'w') as f:
    f.write('\n'.join(linhas) + '\n')

print(f"conteudo.sql: {len(TODOS_POPS)} POPs novos em "
      f"{len(set(p['setor'] for p in TODOS_POPS))} setores + "
      f"{len(JORNADAS_FECHAMENTO)} jornadas "
      f"({sum(len(j['etapas']) for j in JORNADAS_FECHAMENTO)} etapas)")
