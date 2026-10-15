"""Resultado de 2022 por município (1º e 2º turno) para comparar com 2026.

Saídas em dados/tratados/:
  presidente_2022_municipio.csv — votos por candidato, turno e município
  governador_2022_municipio.csv — idem, só para as UFs com 2º turno em 2026
  comparecimento_2022_municipio.csv — aptos, comparecimento, abstenção, brancos, nulos
"""

import zipfile

import pandas as pd

BRUTOS = "dados/brutos"
SAIDA = "dados/tratados"
UFS_2T_GOV = ["AC", "AM", "DF", "ES", "RJ", "RN", "TO"]

COLS_VOTO = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "CD_CARGO",
             "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO", "QT_VOTOS_NOMINAIS_VALIDOS"]


def ler(z, nome, cols):
    return pd.read_csv(z.open(nome), sep=";", encoding="latin1", usecols=cols,
                       dtype={"CD_MUNICIPIO": str})


def votos_por_municipio(df):
    df["candidato"] = df["NM_URNA_CANDIDATO"] + " (" + df["SG_PARTIDO"] + ")"
    g = (df.groupby(["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "candidato"])
           ["QT_VOTOS_NOMINAIS_VALIDOS"].sum().unstack(fill_value=0).reset_index())
    g.columns.name = None
    return g.rename(columns={"NR_TURNO": "turno", "SG_UF": "uf",
                             "CD_MUNICIPIO": "cd_tse", "NM_MUNICIPIO": "municipio"})


def gravar(df, nome):
    df["cd_tse"] = df["cd_tse"].str.zfill(5)
    df.to_csv(f"{SAIDA}/{nome}", sep=";", index=False, encoding="utf-8-sig")
    print(f"{nome}: {len(df)} linhas")


if __name__ == "__main__":
    with zipfile.ZipFile(f"{BRUTOS}/votacao_candidato_munzona_2022.zip") as z:
        pres = ler(z, "votacao_candidato_munzona_2022_BR.csv", COLS_VOTO)
        gravar(votos_por_municipio(pres[pres.CD_CARGO == 1]), "presidente_2022_municipio.csv")

        gov = pd.concat(
            ler(z, f"votacao_candidato_munzona_2022_{uf}.csv", COLS_VOTO).query("CD_CARGO == 3")
            for uf in UFS_2T_GOV
        )
        gravar(votos_por_municipio(gov), "governador_2022_municipio.csv")

    cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "CD_CARGO", "QT_APTOS",
            "QT_COMPARECIMENTO", "QT_ABSTENCOES", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]
    with zipfile.ZipFile(f"{BRUTOS}/detalhe_votacao_munzona_2022.zip") as z:
        det = ler(z, "detalhe_votacao_munzona_2022_BRASIL.csv", cols).query("CD_CARGO == 1")
    comp = (det.groupby(["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO"], as_index=False)
               [cols[5:]].sum())
    comp.columns = ["turno", "uf", "cd_tse", "municipio", "aptos", "comparecimento",
                    "abstencao", "brancos", "nulos"]
    gravar(comp, "comparecimento_2022_municipio.csv")
