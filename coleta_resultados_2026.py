"""Baixa o resultado de 2026 por município (presidente e governadores com 2º turno) e grava CSVs em dados/tratados/.

Uso: python3 coleta_resultados_2026.py [--turno 1|2] [--parcial]
  --turno 2  usa as eleições do 2º turno (6258 federal, 6260 estadual) e grava *_2t_*.csv
  --parcial  aceita apuração incompleta (sem isso, exige 100% das seções totalizadas)
Também grava dados/tratados/coleta_{turno}t_meta.json com data/hora e % apurado informados pelo TSE.
"""

import argparse
import csv
import json
import os
from concurrent.futures import ThreadPoolExecutor

from tse_client import RESULTADOS, get_json, municipios

CICLO = "ele2026"
ELEICOES = {1: {"presidente": (6257, 1), "governador": (6259, 3)}, 2: {"presidente": (6258, 1), "governador": (6260, 3)}}
# UFs com 2º turno de governador: vêm da configuração do TSE (eleição 6260); a lista abaixo é só conferência
UFS_2T_GOV_ESPERADAS = ["ac", "am", "df", "es", "rj", "rn", "to"]

BRUTOS = "dados/brutos/resultados_2026"
SAIDA = "dados/tratados"


def num(x):
    return int(x) if x not in (None, "") else 0


def baixar(eleicao, cargo, uf, cd_mun, usar_cache):
    """Lê do cache local ou baixa o JSON do município. Um município com 100% das seções não muda mais:
    o cache vale sempre; com a apuração nacional incompleta (usar_cache=False) só os municípios a 100% são reaproveitados."""
    nome = f"{uf}{cd_mun}-c{cargo:04d}-e{eleicao:06d}-u.json"
    cache = os.path.join(BRUTOS, nome)
    if os.path.exists(cache):
        try:
            with open(cache, encoding="utf-8") as f:
                d = json.load(f)
            if d.get("s", {}).get("pstn") == "100":
                return d
        except json.JSONDecodeError:
            pass  # cache truncado por interrupção: baixa de novo
    d = get_json(f"{RESULTADOS}/{CICLO}/{eleicao}/dados/{uf}/{nome}")
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    return d


def linha_municipio(d, mun):
    e, v, s = d["e"], d["v"], d.get("s", {})
    linha = {
        "uf": mun["uf"].upper(), "cd_tse": mun["cd"], "cd_ibge": mun["cdi"],
        "municipio": mun["nm"], "capital": mun["c"] == "s",
        "eleitorado": num(e["te"]), "comparecimento": num(e["c"]),
        "abstencao": num(e["a"]), "brancos": num(v["vb"]), "nulos": num(v["tvn"]),
        # base oficial do % do TSE: válidos + votos de candidatos sub judice
        "validos": num(v["vvc"]), "validos_sem_sub_judice": num(v["vv"]), "sub_judice": num(v["vansj"]),
        "pct_secoes_apuradas": float(str(s.get("pstn", "0")).replace(",", ".")),
    }
    assert linha["validos"] - linha["sub_judice"] == linha["validos_sem_sub_judice"], mun["nm"]
    for agr in d["carg"][0].get("agr", []):
        for par in agr.get("par", []):
            for c in par.get("cand", []):
                linha[f"{c['nmu']} ({par['sg']})"] = num(c["vap"])
    return linha


def coletar(eleicao, cargo, ufs, cfg, usar_cache):
    tarefas = [{**m, "uf": abr["cd"]} for abr in cfg["abr"] if abr["cd"] in ufs for m in abr["mu"]]

    def um(mun):
        return linha_municipio(baixar(eleicao, cargo, mun["uf"], mun["cd"], usar_cache), mun)

    # poucas conexões por vez: o TSE (Akamai) recusa rajadas do mesmo IP; get_json repete em caso de falha
    with ThreadPoolExecutor(max_workers=8) as ex:
        return list(ex.map(um, tarefas))


def gravar(linhas, nome):
    candidatos = sorted({k for l in linhas for k in l if "(" in k}, key=lambda k: -sum(l.get(k, 0) for l in linhas))
    fixas = [k for k in linhas[0] if "(" not in k]
    caminho = os.path.join(SAIDA, nome)
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fixas + candidatos, restval=0, delimiter=";")
        w.writeheader()
        w.writerows(linhas)
    print(f"{caminho}: {len(linhas)} municípios, {len(candidatos)} candidatos")


def meta_nacional(eleicao, cargo):
    """Data/hora e % apurado do arquivo nacional, para registrar de quando é a coleta."""
    d = get_json(f"{RESULTADOS}/{CICLO}/{eleicao}/dados/br/br-c{cargo:04d}-e{eleicao:06d}-u.json")
    return {"eleicao": eleicao, "gerado_em": f"{d.get('dg')} {d.get('hg')}", "pct_secoes": float(str(d["s"]["pstn"]).replace(",", ".")),
            "secoes": num(d["s"]["st"]), "secoes_total": num(d["s"]["ts"]), "totalizacao_final": d.get("tf") == "s"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--turno", type=int, choices=[1, 2], default=1)
    ap.add_argument("--parcial", action="store_true", help="aceita apuração incompleta")
    args = ap.parse_args()
    t = args.turno
    pres, gov = ELEICOES[t]["presidente"], ELEICOES[t]["governador"]
    os.makedirs(BRUTOS, exist_ok=True)
    os.makedirs(SAIDA, exist_ok=True)

    meta = meta_nacional(*pres)
    print(f"{t}º turno, eleição {pres[0]}: {meta['pct_secoes']}% das seções, gerado {meta['gerado_em']}")
    if meta["pct_secoes"] < 100 and not args.parcial:
        raise SystemExit("Apuração incompleta. Use --parcial para coletar mesmo assim.")
    completo = meta["pct_secoes"] >= 100

    cfg = municipios(CICLO, pres[0])
    todas_ufs = [a["cd"] for a in cfg["abr"]]  # inclui 'zz' (exterior)
    gravar(coletar(*pres, todas_ufs, cfg, completo), f"presidente_{t}t_2026_municipio.csv")

    # UFs com 2º turno de governador segundo o TSE (abrangência da eleição 6260), nos dois turnos
    cfg_gov2 = municipios(CICLO, ELEICOES[2]["governador"][0])
    ufs_gov_2t = sorted(a["cd"] for a in cfg_gov2["abr"])
    if ufs_gov_2t != sorted(UFS_2T_GOV_ESPERADAS):
        print(f"aviso: TSE lista 2º turno de governador em {ufs_gov_2t} (esperado {sorted(UFS_2T_GOV_ESPERADAS)})")
    cfg_gov = cfg_gov2 if t == 2 else municipios(CICLO, gov[0])
    gravar(coletar(*gov, ufs_gov_2t, cfg_gov, completo), f"governador_{t}t_2026_municipio.csv")
    meta["ufs_gov_2t"] = [u.upper() for u in ufs_gov_2t]

    with open(os.path.join(SAIDA, f"coleta_{t}t_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
