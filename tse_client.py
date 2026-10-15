"""Cliente mínimo para fontes públicas de dados eleitorais brasileiros.

Só usa a biblioteca padrão. Fontes:
  - TSE Resultados (JSON da apuração/divulgação, inclusive em tempo real)
  - TSE Dados Abertos (CKAN: candidatos, eleitorado, contas, pesquisas...)
  - Câmara dos Deputados, Senado Federal e IBGE (dados complementares)
"""

import gzip
import json
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (projeto-IG)", "Accept": "application/json"}

RESULTADOS = "https://resultados.tse.jus.br/oficial"
CKAN = "https://dadosabertos.tse.jus.br/api/3/action"
CAMARA = "https://dadosabertos.camara.leg.br/api/v2"
SENADO = "https://legis.senado.leg.br/dadosabertos"
IBGE = "https://servicodados.ibge.gov.br/api/v1"


def get_json(url, params=None, timeout=60):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":  # IBGE responde gzip mesmo sem Accept-Encoding
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


# ---------------------------------------------------------------- TSE Resultados

def eleicoes():
    """Lista pleitos/eleições disponíveis no portal de resultados."""
    cfg = get_json(f"{RESULTADOS}/comum/config/ele-c.json")
    out = []
    for pl in cfg["pl"]:
        for e in pl["e"]:
            cargos = [c for a in e.get("abr", []) for c in a.get("cp", [])]
            out.append({
                "ciclo": pl["c"], "pleito": pl["cd"], "data": pl["dt"],
                "eleicao": e["cd"], "nome": e["nm"],
                "cargos": {int(c["cd"]): c["ds"] for c in cargos},
            })
    return out


def municipios(ciclo, eleicao):
    """Municípios por UF (código TSE, código IBGE, nome, zonas)."""
    return get_json(f"{RESULTADOS}/{ciclo}/{eleicao}/config/mun-e{int(eleicao):06d}-cm.json")


def resultado(ciclo, eleicao, cargo, abrangencia="br"):
    """Resultado por cargo. abrangencia: 'br', sigla da UF ('sp') ou
    UF + código TSE do município ('sp71072').
    Cargos: 1 Presidente, 3 Governador, 5 Senador, 6 Dep. Federal,
    7 Dep. Estadual, 8 Dep. Distrital, 11 Prefeito, 13 Vereador."""
    uf = abrangencia[:2]
    nome = f"{abrangencia}-c{int(cargo):04d}-e{int(eleicao):06d}-u.json"
    return get_json(f"{RESULTADOS}/{ciclo}/{eleicao}/dados/{uf}/{nome}")


def abrangencia(ciclo, eleicao, uf="br"):
    """Andamento da totalização (seções, eleitorado, comparecimento) por UF."""
    return get_json(f"{RESULTADOS}/{ciclo}/{eleicao}/dados/{uf}/{uf}-e{int(eleicao):06d}-ab.json")


def candidatos_votados(res):
    """Achata o JSON de resultado em uma lista de candidatos ordenada por votos."""
    linhas = []
    for cargo in res["carg"]:
        for agr in cargo.get("agr", []):
            for par in agr.get("par", []):
                for c in par.get("cand", []):
                    linhas.append({
                        "cargo": cargo["nmn"], "numero": c["n"], "nome": c["nmu"],
                        "partido": par["sg"], "votos": int(c["vap"]),
                        "pct": float(c["pvapn"].replace(",", ".")), "situacao": c.get("st", ""),
                    })
    return sorted(linhas, key=lambda x: -x["votos"])


# ---------------------------------------------------------------- TSE Dados Abertos (CKAN)

def ckan_datasets():
    return get_json(f"{CKAN}/package_list")["result"]


def ckan_busca(q, rows=20):
    return get_json(f"{CKAN}/package_search", {"q": q, "rows": rows})["result"]["results"]


def ckan_arquivos(dataset):
    """URLs dos arquivos (ZIP/CSV) de um dataset, ex.: 'candidatos-2026'."""
    pkg = get_json(f"{CKAN}/package_show", {"id": dataset})["result"]
    return [{"nome": r["name"], "formato": r.get("format"), "url": r["url"]}
            for r in pkg["resources"]]


# ---------------------------------------------------------------- Outras fontes

def camara_deputados(**params):
    return get_json(f"{CAMARA}/deputados", params)["dados"]


def senado_senadores_atuais():
    d = get_json(f"{SENADO}/senador/lista/atual.json")
    return d["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]


def ibge_municipios(uf=None):
    path = f"localidades/estados/{uf}/municipios" if uf else "localidades/municipios"
    return get_json(f"{IBGE}/{path}")


if __name__ == "__main__":
    ultima = [e for e in eleicoes() if e["ciclo"] == "ele2026"]
    for e in ultima:
        print(e["eleicao"], e["nome"], e["cargos"])

    pres = resultado("ele2026", 6257, 1)
    print(f"\nPresidente 2026 — atualizado {pres['dg']} {pres['hg']}")
    for c in candidatos_votados(pres)[:5]:
        print(f"  {c['numero']:>3} {c['nome']:<25} {c['partido']:<8} {c['votos']:>12,} {c['pct']:6.2f}%  {c['situacao']}")

    gov_sp = resultado("ele2026", 6259, 3, "sp")
    print(f"\nGovernador SP 2026")
    for c in candidatos_votados(gov_sp)[:3]:
        print(f"  {c['nome']:<25} {c['partido']:<8} {c['votos']:>12,} {c['pct']:6.2f}%  {c['situacao']}")

    print("\nArquivos de candidatos-2026 (CKAN):")
    for a in ckan_arquivos("candidatos-2026")[:5]:
        print("  ", a["formato"], a["url"])

    print("\nDeputados federais em exercício (Câmara):", len(camara_deputados(itens=1000)))
    print("Senadores em exercício (Senado):", len(senado_senadores_atuais()))
    print("Municípios (IBGE):", len(ibge_municipios()))
