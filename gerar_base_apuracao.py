"""Gera deploy/private/base_apuracao.json: votos do 1º turno por município, usados pela projeção da apuração ao vivo."""

import json

import pandas as pd

d = pd.read_csv("dados/tratados/presidente_1t_2026_municipio.csv", sep=";", dtype={"cd_tse": str})
base = {
    f"{r.uf.lower()}{r.cd_tse}": {"uf": r.uf, "eleitorado": int(r.eleitorado), "validos": int(r.validos),
                                  "lula": int(r["LULA (PT)"]), "flavio": int(r["FLAVIO BOLSONARO (PL)"]), "nome": r.municipio}
    for _, r in d.iterrows()
}
with open("deploy/private/base_apuracao.json", "w", encoding="utf-8") as f:
    json.dump(base, f, ensure_ascii=False, separators=(",", ":"))
print(f"base_apuracao.json: {len(base)} municípios, Lula {sum(b['lula'] for b in base.values()):,} × Flávio {sum(b['flavio'] for b in base.values()):,}")
