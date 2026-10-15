"""Baixa o resultado do 1º turno de 2026 por município (presidente e
governadores com 2º turno) e grava CSVs em dados/tratados/.

Uso: python3 coleta_resultados_2026.py
"""

import csv
import json
import os
from concurrent.futures import ThreadPoolExecutor

from tse_client import RESULTADOS, get_json, municipios

CICLO = "ele2026"
PRESIDENTE = (6257, 1)
GOVERNADOR = (6259, 3)
UFS_2T_GOV = ["ac", "am", "df", "es", "rj", "rn", "to"]

BRUTOS = "dados/brutos/resultados_2026"
SAIDA = "dados/tratados"


def num(x):
    return int(x) if x not in (None, "") else 0


def baixar(eleicao, cargo, uf, cd_mun):
    """Lê do cache local ou baixa o JSON do município."""
    nome = f"{uf}{cd_mun}-c{cargo:04d}-e{eleicao:06d}-u.json"
    cache = os.path.join(BRUTOS, nome)
    if os.path.exists(cache):
        try:
            with open(cache, encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass  # cache truncado por interrupção: baixa de novo
    d = get_json(f"{RESULTADOS}/{CICLO}/{eleicao}/dados/{uf}/{nome}")
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    return d


def linha_municipio(d, mun):
    e, v = d["e"], d["v"]
    linha = {
        "uf": mun["uf"].upper(), "cd_tse": mun["cd"], "cd_ibge": mun["cdi"],
        "municipio": mun["nm"], "capital": mun["c"] == "s",
        "eleitorado": num(e["te"]), "comparecimento": num(e["c"]),
        "abstencao": num(e["a"]), "brancos": num(v["vb"]), "nulos": num(v["tvn"]),
        # base oficial do % do TSE: válidos + votos de candidatos sub judice
        "validos": num(v["vvc"]), "sub_judice": num(v["vansj"]),
    }
    for agr in d["carg"][0].get("agr", []):
        for par in agr.get("par", []):
            for c in par.get("cand", []):
                linha[f"{c['nmu']} ({par['sg']})"] = num(c["vap"])
    return linha


def coletar(eleicao, cargo, ufs, cfg):
    tarefas = [
        {**m, "uf": abr["cd"]}
        for abr in cfg["abr"] if abr["cd"] in ufs
        for m in abr["mu"]
    ]

    def um(mun):
        return linha_municipio(baixar(eleicao, cargo, mun["uf"], mun["cd"]), mun)

    with ThreadPoolExecutor(max_workers=24) as ex:
        return list(ex.map(um, tarefas))


def gravar(linhas, nome):
    candidatos = sorted(
        {k for l in linhas for k in l if "(" in k},
        key=lambda k: -sum(l.get(k, 0) for l in linhas),
    )
    fixas = [k for k in linhas[0] if "(" not in k]
    caminho = os.path.join(SAIDA, nome)
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fixas + candidatos, restval=0, delimiter=";")
        w.writeheader()
        w.writerows(linhas)
    print(f"{caminho}: {len(linhas)} municípios, {len(candidatos)} candidatos")


if __name__ == "__main__":
    os.makedirs(BRUTOS, exist_ok=True)
    os.makedirs(SAIDA, exist_ok=True)

    cfg = municipios(CICLO, PRESIDENTE[0])
    todas_ufs = [a["cd"] for a in cfg["abr"]]  # inclui 'zz' (exterior)
    gravar(coletar(*PRESIDENTE, todas_ufs, cfg), "presidente_1t_2026_municipio.csv")

    cfg_gov = municipios(CICLO, GOVERNADOR[0])
    gravar(coletar(*GOVERNADOR, UFS_2T_GOV, cfg_gov), "governador_1t_2026_municipio.csv")
