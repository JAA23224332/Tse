"""Microdados por seção eleitoral do 1º turno de 2026 (cargo presidente).

Entrada: dados/brutos/secao/votacao_secao_2026_BR.zip (votos por seção e candidato)
         dados/brutos/eleitorado_local_votacao_2026.zip (seção: local, endereço, bairro, aptos, acessibilidade)
Saída:   dados/tratados/secoes_2026.csv — uma seção por linha, com votos de cada candidato (colunas v<numero>),
         brancos, nulos, comparecimento e abstenção.
         dados/tratados/candidatos_2026.csv — número e nome de cada candidato a presidente.
"""

import zipfile

import pandas as pd

B, T = "dados/brutos", "dados/tratados"
CHAVE = ["SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_SECAO"]
COLS = CHAVE + ["CD_CARGO", "NR_VOTAVEL", "NM_VOTAVEL", "QT_VOTOS", "NR_LOCAL_VOTACAO"]


def ler_votos():
    partes, nomes = [], {}
    with zipfile.ZipFile(f"{B}/secao/votacao_secao_2026_BR.zip") as z:
        nome = [n for n in z.namelist() if n.endswith(".csv")][0]
        for chunk in pd.read_csv(z.open(nome), sep=";", encoding="latin1", usecols=COLS,
                                 dtype={"CD_MUNICIPIO": str, "NR_VOTAVEL": str}, chunksize=1_000_000):
            c = chunk[(chunk.CD_CARGO == 1) & (chunk.SG_UF != "ZZ")]
            nomes.update(dict(zip(c.NR_VOTAVEL, c.NM_VOTAVEL)))
            partes.append(c.groupby(CHAVE + ["NR_LOCAL_VOTACAO", "NR_VOTAVEL"], as_index=False).QT_VOTOS.sum())
    g = pd.concat(partes).groupby(CHAVE + ["NR_LOCAL_VOTACAO", "NR_VOTAVEL"], as_index=False).QT_VOTOS.sum()
    g["CD_MUNICIPIO"] = g.CD_MUNICIPIO.str.zfill(5)
    w = g.pivot_table(index=CHAVE + ["NR_LOCAL_VOTACAO"], columns="NR_VOTAVEL", values="QT_VOTOS", aggfunc="sum", fill_value=0)
    w.columns = [f"v{c}" for c in w.columns]
    return w.reset_index(), nomes


def ler_secoes():
    cols = ["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "NR_ZONA", "NR_SECAO", "DS_TIPO_SECAO_AGREGADA", "NR_SECAO_PRINCIPAL",
            "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO", "DS_TIPO_LOCAL", "DS_ENDERECO", "NM_BAIRRO", "NR_CEP",
            "NR_LATITUDE", "NR_LONGITUDE", "DS_SITU_SECAO_ACESSIBILIDADE", "QT_ELEITOR_SECAO", "QT_ELEITOR_ELEICAO_FEDERAL"]
    partes = []
    with zipfile.ZipFile(f"{B}/eleitorado_local_votacao_2026.zip") as z:
        for n in z.namelist():
            if n.endswith(".csv") and "BRASIL" not in n and "_ZZ" not in n:
                partes.append(pd.read_csv(z.open(n), sep=";", encoding="latin1", usecols=cols,
                                          dtype={"CD_MUNICIPIO": str, "NR_CEP": str, "NR_LATITUDE": str, "NR_LONGITUDE": str}))
    df = pd.concat(partes)
    df["CD_MUNICIPIO"] = df.CD_MUNICIPIO.str.zfill(5)
    for c in ["NR_LATITUDE", "NR_LONGITUDE"]:
        df[c] = pd.to_numeric(df[c].str.replace(",", "."), errors="coerce").where(lambda s: s.abs() > 0.01)
    # uma seção pode aparecer mais de uma vez (turnos/eleições); fica a linha com mais aptos
    df = df.sort_values("QT_ELEITOR_ELEICAO_FEDERAL", ascending=False).drop_duplicates(CHAVE)
    return df.rename(columns={
        "NM_MUNICIPIO": "municipio", "DS_TIPO_SECAO_AGREGADA": "tipo_secao", "NR_SECAO_PRINCIPAL": "secao_principal",
        "NM_LOCAL_VOTACAO": "local", "DS_TIPO_LOCAL": "tipo_local", "DS_ENDERECO": "endereco", "NM_BAIRRO": "bairro",
        "NR_CEP": "cep", "NR_LATITUDE": "lat", "NR_LONGITUDE": "lon", "DS_SITU_SECAO_ACESSIBILIDADE": "acessibilidade",
        "QT_ELEITOR_SECAO": "eleitores_secao", "QT_ELEITOR_ELEICAO_FEDERAL": "aptos"})


if __name__ == "__main__":
    votos, nomes = ler_votos()
    print(len(votos), "seções com votos |", len(nomes), "votáveis", flush=True)
    sec = ler_secoes()
    print(len(sec), "seções no cadastro", flush=True)
    # seções agregadas votam na seção principal: o cadastro traz as duas, os votos só a principal
    df = sec.merge(votos.drop(columns="NR_LOCAL_VOTACAO"), on=CHAVE, how="left")
    vcols = [c for c in votos.columns if c.startswith("v")]
    df[vcols] = df[vcols].fillna(0).astype(int)
    df["lula"], df["flavio"] = df.get("v13", 0), df.get("v22", 0)
    df["brancos"], df["nulos"] = df.get("v95", 0), df.get("v96", 0)
    df["comparecimento"] = df[vcols].sum(axis=1)
    df["validos"] = df.comparecimento - df.brancos - df.nulos
    df["eliminados"] = df.validos - df.lula - df.flavio
    df["abstencao"] = (df.aptos - df.comparecimento).clip(lower=0)
    df["pct_lula"] = (100 * df.lula / df.validos.where(df.validos > 0)).round(1)
    df["pct_flavio"] = (100 * df.flavio / df.validos.where(df.validos > 0)).round(1)
    df["pct_abstencao"] = (100 * df.abstencao / df.aptos.where(df.aptos > 0)).round(1)
    df["margem_lula"] = df.lula - df.flavio
    df = df.rename(columns={"SG_UF": "uf", "CD_MUNICIPIO": "cd_tse", "NR_ZONA": "zona", "NR_SECAO": "secao", "NR_LOCAL_VOTACAO": "nr_local"})
    ordem = ["uf", "cd_tse", "municipio", "zona", "secao", "tipo_secao", "secao_principal", "nr_local", "local", "tipo_local",
             "endereco", "bairro", "cep", "lat", "lon", "acessibilidade", "eleitores_secao", "aptos", "comparecimento", "abstencao",
             "validos", "lula", "flavio", "eliminados", "brancos", "nulos", "pct_lula", "pct_flavio", "pct_abstencao", "margem_lula"]
    df = df[ordem + [c for c in vcols if c not in ("v13", "v22", "v95", "v96")]].sort_values(["uf", "cd_tse", "zona", "secao"])
    df.to_csv(f"{T}/secoes_2026.csv", sep=";", index=False, encoding="utf-8-sig")
    cand = pd.DataFrame(sorted(nomes.items()), columns=["numero", "nome"])
    cand.to_csv(f"{T}/candidatos_2026.csv", sep=";", index=False, encoding="utf-8-sig")
    print(len(df), "seções |", df.aptos.sum(), "aptos |", df.comparecimento.sum(), "comparecimento |", df.lula.sum(), "Lula |", df.flavio.sum(), "Flávio")
    print(cand.to_string(index=False))
