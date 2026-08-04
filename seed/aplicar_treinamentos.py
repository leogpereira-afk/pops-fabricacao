# -*- coding: utf-8 -*-
"""Insere os treinamentos (código de ética, normas e esporádicos)."""
import json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
from treinamentos import TREINAMENTOS  # noqa: E402

sql = lambda o: "$json$" + json.dumps(o, ensure_ascii=False) + "$json$"
linhas = [
    "insert into pops_registros (colecao, id, registro, atualizado_em) values "
    f"('treinamentos', '{t['id']}', {sql(t)}::jsonb, now()) "
    "on conflict (colecao, id) do update set registro = excluded.registro, "
    "atualizado_em = now(), apagado = false;" for t in TREINAMENTOS
]
linhas.append(
    "update pops_meta set valor = jsonb_set(valor, '{porColecao,treinamentos}', "
    "to_jsonb(extract(epoch from now())::bigint)), atualizado_em = now() where chave = 'rev';")
open(os.path.join(AQUI, 'treinamentos.sql'), 'w').write('\n'.join(linhas) + '\n')
print(f"treinamentos.sql: {len(TREINAMENTOS)} treinamentos")
