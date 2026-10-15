"""Agrega a votação para presidente (1º turno 2026) por local de votação (escola, etc.).

Entrada: dados/brutos/secao/votacao_secao_2026_BR.zip (TSE, cargo presidente) e
         dados/brutos/eleitorado_local_votacao_2026.zip (endereço, bairro, lat/long, aptos)
Saída:   dados/tratados/locais_votacao_2026.csv — um local por linha, com votos, abstenção e
         potencial de ganho para Lula (mesma lógica do motor de estratégia, em escala local).
"""

import os
import zipfile

import pandas as pd

import glob
import json

from estrategia import LIMIAR_REDUTO_PP, PREMISSAS

B, T = "dados/brutos", "dados/tratados"
TURNO = int(os.environ.get("TURNO", "1"))  # 1 ou 2; os ZIPs do TSE passam a trazer os dois turnos após 25/10
SUFIXO = "" if TURNO == 1 else f"_{TURNO}t"
CHAVE = ["SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO"]
COLS = CHAVE + ["NR_TURNO", "CD_CARGO", "NR_VOTAVEL", "QT_VOTOS", "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO_ENDERECO"]
NUMEROS = {"13": "lula", "22": "flavio", "95": "brancos", "96": "nulos"}


def premissas_por_numero():
    """Número de urna → premissas do candidato, lido de um JSON de resultado já baixado pela coleta."""
    arq = sorted(glob.glob(f"{B}/resultados_2026/*-c0001-e006257-u.json"))[0]
    with open(arq, encoding="utf-8") as f:
        d = json.load(f)
    por_num = {}
    for agr in d["carg"][0]["agr"]:
        for par in agr["par"]:
            for c in par["cand"]:
                chave = f"{c['nmu']} ({par['sg']})"
                if chave in PREMISSAS["eliminados"]:
                    por_num[c["n"]] = PREMISSAS["eliminados"][chave]
    return por_num


def ler_uf(caminho):
    partes = []
    with zipfile.ZipFile(caminho) as z:
        nome = [n for n in z.namelist() if n.endswith(".csv")][0]
        for chunk in pd.read_csv(z.open(nome), sep=";", encoding="latin1", usecols=COLS,
                                 dtype={"CD_MUNICIPIO": str, "NR_VOTAVEL": str}, chunksize=1_000_000):
            c = chunk[(chunk.NR_TURNO == TURNO) & (chunk.CD_CARGO == 1)]
            c = c.assign(tipo=c.NR_VOTAVEL.map(NUMEROS).fillna("e" + c.NR_VOTAVEL))  # e<numero> = candidato eliminado
            partes.append(c.groupby(CHAVE + ["tipo"], as_index=False).QT_VOTOS.sum())
    g = pd.concat(partes).groupby(CHAVE + ["tipo"], as_index=False).QT_VOTOS.sum()
    g["CD_MUNICIPIO"] = g["CD_MUNICIPIO"].str.zfill(5)  # o cadastro de locais usa 5 dígitos
    return g.pivot_table(index=CHAVE, columns="tipo", values="QT_VOTOS", aggfunc="sum", fill_value=0).reset_index()


def ler_locais():
    cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO",
            "DS_ENDERECO", "NM_BAIRRO", "NR_LATITUDE", "NR_LONGITUDE", "QT_ELEITOR_ELEICAO_FEDERAL"]
    partes = []
    with zipfile.ZipFile(f"{B}/eleitorado_local_votacao_2026.zip") as z:
        for n in z.namelist():
            if n.endswith(".csv") and "BRASIL" not in n:
                partes.append(pd.read_csv(z.open(n), sep=";", encoding="latin1", usecols=cols,
                                          dtype={"CD_MUNICIPIO": str, "NR_LATITUDE": str, "NR_LONGITUDE": str}))
    df = pd.concat(partes)
    df = df[df.NR_TURNO == TURNO].drop(columns="NR_TURNO")
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
    loc = ler_locais().merge(votos, on=CHAVE, how="left")   # locais do cadastro sem votos ficam com zero
    sem_cadastro = votos.merge(ler_locais()[CHAVE], on=CHAVE, how="left", indicator=True).query('_merge == "left_only"')
    print(len(sem_cadastro), "locais com votos sem cadastro (votos:", int(sem_cadastro.get("lula", 0).sum()), "Lula)")
    ecols = [c for c in loc.columns if c.startswith("e") and c[1:].isdigit()]
    for c in ["lula", "flavio", "brancos", "nulos", *ecols]:
        loc[c] = loc[c].fillna(0).astype(int) if c in loc else 0
    loc["eliminados"] = loc[ecols].sum(axis=1)
    loc = loc[(loc.aptos > 0) | (loc[["lula", "flavio", "brancos", "nulos", "eliminados"]].sum(axis=1) > 0)]  # linhas vazias do cadastro
    loc["comparecimento"] = loc[["lula", "flavio", "brancos", "nulos", "eliminados"]].sum(axis=1)
    loc["aptos_cadastro"] = loc.aptos
    loc["aptos"] = loc[["aptos", "comparecimento"]].max(axis=1)      # cadastro com menos aptos que votos: usa os votos
    loc["abstencao"] = loc.aptos - loc.comparecimento
    loc["validos"] = loc.lula + loc.flavio + loc.eliminados
    loc["pct_lula"] = (100 * loc.lula / loc.validos.where(loc.validos > 0)).round(1)
    loc["pct_flavio"] = (100 * loc.flavio / loc.validos.where(loc.validos > 0)).round(1)
    loc["pct_abstencao"] = (100 * loc.abstencao / loc.aptos.where(loc.aptos > 0)).round(1)
    loc["margem_lula"] = loc.lula - loc.flavio
    margem_pp = (loc.pct_lula - loc.pct_flavio).fillna(0)
    loc["territorio"] = pd.cut(margem_pp, [-1e9, -LIMIAR_REDUTO_PP, LIMIAR_REDUTO_PP, 1e9], labels=["Reduto de Flávio", "Disputado", "Reduto de Lula"]).astype(str)
    # mesma lógica do motor municipal: mobilizar (líquido, com sinal) e persuadir por candidato
    queda = loc.territorio.map(PREMISSAS["queda_abstencao"]).astype(float)
    loc["mobilizar_liquido"] = (loc.aptos * queda / 100 * margem_pp / 100).round(1)
    loc["ganho_mobilizar"] = loc.mobilizar_liquido.clip(lower=0)
    pn = premissas_por_numero()
    para_lula = sum(loc[c] * pn.get(c[1:], {"lula": 0})["lula"] for c in ecols) + (loc.brancos + loc.nulos) * PREMISSAS["brancos_nulos"]["lula"]
    para_flavio = sum(loc[c] * pn.get(c[1:], {"flavio": 0})["flavio"] for c in ecols) + (loc.brancos + loc.nulos) * PREMISSAS["brancos_nulos"]["flavio"]
    loc["ganho_persuadir"] = para_lula.round(1)
    loc["persuadir_liquido"] = (para_lula - para_flavio).round(1)
    loc["ganho_total"] = loc.ganho_mobilizar + loc.ganho_persuadir
    loc["saldo_liquido"] = loc.mobilizar_liquido + loc.persuadir_liquido
    loc = loc.drop(columns=ecols)
    loc = loc.rename(columns={"SG_UF": "uf", "CD_MUNICIPIO": "cd_tse", "NR_ZONA": "zona", "NR_LOCAL_VOTACAO": "nr_local"})
    loc["cd_tse"] = loc.cd_tse.str.zfill(5)
    loc = loc.sort_values("ganho_total", ascending=False)
    loc.to_csv(f"{T}/locais_votacao_2026{SUFIXO}.csv", sep=";", index=False, encoding="utf-8-sig")
    print(len(loc), "locais |", loc.aptos.sum(), "aptos |", loc.lula.sum(), "Lula |", loc.flavio.sum(), "Flávio")
