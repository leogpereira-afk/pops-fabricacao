"""Gera pacote privado de revisão. Não conecta à API nem publica documentos."""
from pathlib import Path
import json,hashlib,fitz
base=Path(__file__).resolve().parents[2]/'outputs'
manifest=json.loads((base/'Educacao_Impresilk_2026-10-08/fontes-para-preparacao.json').read_text())
out=[]
for d in manifest['documentos']:
 p=Path(d['arquivoLocal']); raw=p.read_bytes(); digest=hashlib.sha256(raw).hexdigest()
 if digest!=d['sha256']: raise RuntimeError('Fonte mudou: '+p.name)
 doc=fitz.open(p)
 out.append(dict(id=d['id'],titulo=d['titulo'].replace('Operacoes de Maquinas','Operações de Máquinas').replace('Producao','Produção').replace('Comunicacao','Comunicação').replace('Funcoes','Funções').replace('Instalacao','Instalação').replace('Codigo de Etica e Conduta 2026 2','Código de Ética e Conduta'),tipo='documento',categoria='Código de Ética' if 'Etica' in p.name else 'Cadernos da função',versao=d['versao'],objetivo='Estudar o documento integral da Impresilk. A gestão deve conferir a versão e preparar as avaliações antes da liberação.',setor='Institucional',ativa=True,publicada=False,liberacao={'pessoas':[],'cargos':[],'setores':[],'todos':False},paginas=[page.get_text(sort=True) for page in doc],arquivoLocal=str(p),arquivoHash=digest,arquivoVersao=d['versao'],arquivoPath=d['id']+'/'+digest+'.pdf',origem={'estado':'preparacao','conferirVersaoOficial':True,'sha256':digest,'paginas':len(doc)}))
folder=base/'Escola_Impresilk_2026-10-08';folder.mkdir(exist_ok=True)
(folder/'materiais-integrais-privados.json').write_text(json.dumps({'somenteRevisao':True,'materiais':out},ensure_ascii=False,indent=2))
print(json.dumps({'materiais':len(out),'paginas':sum(len(m['paginas']) for m in out),'bytesTexto':sum(len(json.dumps(m,ensure_ascii=False)) for m in out)},ensure_ascii=False))
