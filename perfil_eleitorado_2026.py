"""Agrega o perfil do eleitorado 2026 (TSE) por município.

Entrada: dados/brutos/perfil_eleitorado_2026.zip
Saídas em dados/tratados/:
  perfil_eleitorado_2026_long.parquet  — município × dimensão × categoria × eleitores
  perfil_eleitorado_2026_municipio.csv — uma linha por município, % por categoria
"""

import zipfile

import pandas as pd

ZIP = "dados/brutos/perfil_eleitorado_2026.zip"
SAIDA = "dados/tratados"

COLS = ["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "DS_GENERO", "DS_ESTADO_CIVIL",
        "CD_FAIXA_ETARIA", "DS_GRAU_ESCOLARIDADE", "DS_RACA_COR", "QT_ELEITORES"]


def faixa_idade(cd):
    """Agrupa o código de faixa etária do TSE (ex.: 3034 = 30 a 34 anos)."""
    ini = int(str(cd)[:2]) if cd >= 1000 else -1
    if ini < 0:
        return "Não informado"
    for lim, rotulo in [(18, "16-17"), (25, "18-24"), (35, "25-34"), (45, "35-44"),
                        (60, "45-59"), (70, "60-69")]:
        if ini < lim:
            return rotulo
    return "70+"


ESCOLARIDADE = {
    "ANALFABETO": "Até fundamental", "LÊ E ESCREVE": "Até fundamental",
    "ENSINO FUNDAMENTAL INCOMPLETO": "Até fundamental",
    "ENSINO FUNDAMENTAL COMPLETO": "Até fundamental",
    "ENSINO MÉDIO INCOMPLETO": "Médio", "ENSINO MÉDIO COMPLETO": "Médio",
    "SUPERIOR INCOMPLETO": "Superior", "SUPERIOR COMPLETO": "Superior",
}


def ler_uf(z, nome):
    df = pd.read_csv(z.open(nome), sep=";", encoding="latin1", usecols=COLS,
                     dtype={"CD_MUNICIPIO": str})
    df["sexo"] = df["DS_GENERO"].str.title()
    df["idade"] = df["CD_FAIXA_ETARIA"].map(faixa_idade)
    df["escolaridade"] = df["DS_GRAU_ESCOLARIDADE"].map(ESCOLARIDADE).fillna("Não informado")
    df["estado_civil"] = df["DS_ESTADO_CIVIL"].str.title()
    df["raca_cor"] = df["DS_RACA_COR"].str.title()
    chave = ["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO"]
    partes = []
    for dim in ["sexo", "idade", "escolaridade", "estado_civil", "raca_cor"]:
        g = df.groupby(chave + [dim], as_index=False)["QT_ELEITORES"].sum()
        partes.append(g.rename(columns={dim: "categoria"}).assign(dimensao=dim))
    return pd.concat(partes)


if __name__ == "__main__":
    with zipfile.ZipFile(ZIP) as z:
        nomes = [n for n in z.namelist() if n.endswith(".csv") and "BRASIL" not in n]
        longo = pd.concat(ler_uf(z, n) for n in sorted(nomes))

    longo = longo.rename(columns={"SG_UF": "uf", "CD_MUNICIPIO": "cd_tse",
                                  "NM_MUNICIPIO": "municipio", "QT_ELEITORES": "eleitores"})
    longo["cd_tse"] = longo["cd_tse"].str.zfill(5)
    longo.to_parquet(f"{SAIDA}/perfil_eleitorado_2026_long.parquet", index=False)

    chave = ["uf", "cd_tse", "municipio"]
    total = longo[longo.dimensao == "sexo"].groupby(chave)["eleitores"].sum().rename("eleitorado_perfil")
    largo = longo.pivot_table(index=chave, columns=["dimensao", "categoria"],
                              values="eleitores", aggfunc="sum", fill_value=0)
    pct = largo.div(total, axis=0).mul(100).round(2)
    pct.columns = [f"pct_{d}_{c}" for d, c in pct.columns]
    pct = pct.join(total).reset_index()
    pct.to_csv(f"{SAIDA}/perfil_eleitorado_2026_municipio.csv", sep=";", index=False,
               encoding="utf-8-sig")
    print(f"{len(pct)} municípios, {int(total.sum()):,} eleitores")
