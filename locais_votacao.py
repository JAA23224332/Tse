"""Agrega a votação para presidente (1º turno 2026) por local de votação (escola, etc.).

Entrada: dados/brutos/secao/votacao_secao_2026_BR.zip (TSE, cargo presidente) e
         dados/brutos/eleitorado_local_votacao_2026.zip (endereço, bairro, lat/long, aptos)
Saída:   dados/tratados/locais_votacao_2026.csv — um local por linha, com votos, abstenção e
         potencial de ganho para Lula (mesma lógica do motor de estratégia, em escala local).
"""

import zipfile

import pandas as pd

from estrategia import PREMISSAS

B, T = "dados/brutos", "dados/tratados"
CHAVE = ["SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO"]
COLS = CHAVE + ["CD_CARGO", "NR_VOTAVEL", "QT_VOTOS", "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO_ENDERECO"]
NUMEROS = {"13": "lula", "22": "flavio", "95": "brancos", "96": "nulos"}


def ler_uf(caminho):
    partes = []
    with zipfile.ZipFile(caminho) as z:
        nome = [n for n in z.namelist() if n.endswith(".csv")][0]
        for chunk in pd.read_csv(z.open(nome), sep=";", encoding="latin1", usecols=COLS,
                                 dtype={"CD_MUNICIPIO": str, "NR_VOTAVEL": str}, chunksize=1_000_000):
            c = chunk[chunk.CD_CARGO == 1]
            c = c.assign(tipo=c.NR_VOTAVEL.map(NUMEROS).fillna("eliminados"))
            partes.append(c.groupby(CHAVE + ["tipo"], as_index=False).QT_VOTOS.sum())
    g = pd.concat(partes).groupby(CHAVE + ["tipo"], as_index=False).QT_VOTOS.sum()
    g["CD_MUNICIPIO"] = g["CD_MUNICIPIO"].str.zfill(5)  # o cadastro de locais usa 5 dígitos
    return g.pivot_table(index=CHAVE, columns="tipo", values="QT_VOTOS", aggfunc="sum", fill_value=0).reset_index()


def ler_locais():
    cols = ["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO",
            "DS_ENDERECO", "NM_BAIRRO", "NR_LATITUDE", "NR_LONGITUDE", "QT_ELEITOR_ELEICAO_FEDERAL"]
    partes = []
    with zipfile.ZipFile(f"{B}/eleitorado_local_votacao_2026.zip") as z:
        for n in z.namelist():
            if n.endswith(".csv") and "BRASIL" not in n:
                partes.append(pd.read_csv(z.open(n), sep=";", encoding="latin1", usecols=cols,
                                          dtype={"CD_MUNICIPIO": str, "NR_LATITUDE": str, "NR_LONGITUDE": str}))
    df = pd.concat(partes)
    df["CD_MUNICIPIO"] = df["CD_MUNICIPIO"].str.zfill(5)
    for c in ["NR_LATITUDE", "NR_LONGITUDE"]:
        df[c] = pd.to_numeric(df[c].str.replace(",", "."), errors="coerce").where(lambda s: s.abs() > 0.01)
    return df.groupby(CHAVE, as_index=False).agg(
        municipio=("NM_MUNICIPIO", "first"), local=("NM_LOCAL_VOTACAO", "first"), endereco=("DS_ENDERECO", "first"),
        bairro=("NM_BAIRRO", "first"), lat=("NR_LATITUDE", "first"), lon=("NR_LONGITUDE", "first"),
        aptos=("QT_ELEITOR_ELEICAO_FEDERAL", "sum"))


if __name__ == "__main__":
    # a votação para presidente por seção está no arquivo _BR (os arquivos por UF trazem os cargos estaduais)
    votos = ler_uf(f"{B}/secao/votacao_secao_2026_BR.zip")
    votos = votos[votos.SG_UF != "ZZ"]
    print(len(votos), "locais com votos", flush=True)
    loc = ler_locais().merge(votos, on=CHAVE, how="inner")
    for c in ["lula", "flavio", "brancos", "nulos", "eliminados"]:
        loc[c] = loc[c].astype(int) if c in loc else 0
    loc["comparecimento"] = loc[["lula", "flavio", "brancos", "nulos", "eliminados"]].sum(axis=1)
    loc["abstencao"] = (loc.aptos - loc.comparecimento).clip(lower=0)
    loc["validos"] = loc.lula + loc.flavio + loc.eliminados
    loc["pct_lula"] = (100 * loc.lula / loc.validos).round(1)
    loc["pct_flavio"] = (100 * loc.flavio / loc.validos).round(1)
    loc["pct_abstencao"] = (100 * loc.abstencao / loc.aptos).round(1)
    loc["margem_lula"] = loc.lula - loc.flavio
    margem_pp = loc.pct_lula - loc.pct_flavio
    # mesma lógica do motor municipal, com transferência média dos eliminados (sem detalhe por candidato aqui)
    tx_elim = sum(PREMISSAS["transferencia"].values()) / len(PREMISSAS["transferencia"])
    loc["ganho_mobilizar"] = (loc.aptos * PREMISSAS["queda_abstencao_pp"] / 100 * margem_pp / 100).clip(lower=0).round(1)
    loc["ganho_persuadir"] = (loc.eliminados * tx_elim + (loc.brancos + loc.nulos) * PREMISSAS["brancos_nulos"]).round(1)
    loc["ganho_total"] = loc.ganho_mobilizar + loc.ganho_persuadir
    loc["territorio"] = pd.cut(margem_pp, [-1e9, -15, 15, 1e9], labels=["Reduto de Flávio", "Disputado", "Reduto de Lula"]).astype(str)
    loc = loc.rename(columns={"SG_UF": "uf", "CD_MUNICIPIO": "cd_tse", "NR_ZONA": "zona", "NR_LOCAL_VOTACAO": "nr_local"})
    loc["cd_tse"] = loc.cd_tse.str.zfill(5)
    loc = loc.sort_values("ganho_total", ascending=False)
    loc.to_csv(f"{T}/locais_votacao_2026.csv", sep=";", index=False, encoding="utf-8-sig")
    print(len(loc), "locais |", loc.aptos.sum(), "aptos |", loc.lula.sum(), "Lula |", loc.flavio.sum(), "Flávio")
