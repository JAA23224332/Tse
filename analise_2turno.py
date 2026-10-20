"""Análise para o 2º turno de 2026: junta resultado do 1º turno, perfil do
eleitorado e histórico de 2022 por município.

Pré-requisitos: rodar coleta_resultados_2026.py, perfil_eleitorado_2026.py e
historico_2022.py.

Saídas em dados/tratados/:
  base_municipal_2026.csv  — tudo por município (uma linha por município)
  analise_2turno_2026.xlsx — abas de análise
  painel_dados.json        — dados que alimentam o painel HTML
"""

import json

import numpy as np
import pandas as pd

T = "dados/tratados"
FLAVIO, LULA = "FLAVIO BOLSONARO (PL)", "LULA (PT)"
REGIAO = {
    "N": ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
    "NE": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "CO": ["DF", "GO", "MS", "MT"],
    "SE": ["ES", "MG", "RJ", "SP"],
    "S": ["PR", "RS", "SC"],
    "Exterior": ["ZZ"],
}
UF_REGIAO = {uf: r for r, ufs in REGIAO.items() for uf in ufs}
# Finalistas do 2º turno de governador (1º colocado primeiro)
GOV_2T = {
    "AC": ("MAILZA ASSIS (PP)", "ALAN RICK (REPUBLICANOS)"),
    "AM": ("OMAR AZIZ (PSD)", "PROFESSORA MARIA DO CARMO (PL)"),
    "DF": ("CELINA LEÃO (PP)", "LEANDRO GRASS (PT)"),
    "ES": ("LORENZO PAZOLINI (REPUBLICANOS)", "RICARDO FERRAÇO (MDB)"),
    "RJ": ("DOUGLAS RUAS (PL)", "EDUARDO PAES (PSD)"),
    "RN": ("ALLYSON (UNIÃO)", "CADU DE LULA (PT)"),
    "TO": ("PROFESSORA DORINHA (UNIÃO)", "VICENTINHO JÚNIOR (PSDB)"),
}
PERFIL_CHAVE = {
    "pct_sexo_Feminino": "% mulheres",
    "pct_idade_16-17": "% 16-17 anos",
    "pct_idade_18-24": "% 18-24 anos",
    "pct_idade_25-34": "% 25-34 anos",
    "pct_idade_35-44": "% 35-44 anos",
    "pct_idade_45-59": "% 45-59 anos",
    "pct_idade_60-69": "% 60-69 anos",
    "pct_idade_70+": "% 70+ anos",
    "pct_escolaridade_Até fundamental": "% até fundamental",
    "pct_escolaridade_Médio": "% ensino médio",
    "pct_escolaridade_Superior": "% ensino superior",
    "pct_estado_civil_Casado": "% casados",
    "pct_estado_civil_Solteiro": "% solteiros",
}


def atualizado_texto():
    """Data e % apurado informados pelo TSE na coleta (coleta_1t_meta.json), em vez de texto fixo."""
    try:
        with open(f"{T}/coleta_1t_meta.json", encoding="utf-8") as f:
            m = json.load(f)
        return f"1º turno 04/10/2026 — TSE, {m['pct_secoes']:.0f}% das seções totalizadas (totalização de {m['gerado_em']})"
    except (OSError, KeyError):
        return "1º turno 04/10/2026 — TSE"


def ler(nome, **kw):
    return pd.read_csv(f"{T}/{nome}", sep=";", dtype={"cd_tse": str, "cd_ibge": str}, **kw)


def pct(a, b):
    return np.where(b > 0, 100 * a / b, np.nan)


def base_municipal():
    p = ler("presidente_1t_2026_municipio.csv")
    cands = [c for c in p.columns if "(" in c]
    elim = [c for c in cands if c not in (FLAVIO, LULA)]
    p["eliminados"] = p[elim].sum(axis=1)
    p["regiao"] = p["uf"].map(UF_REGIAO)
    p["pct_flavio"] = pct(p[FLAVIO], p["validos"])
    p["pct_lula"] = pct(p[LULA], p["validos"])
    p["pct_eliminados"] = pct(p["eliminados"], p["validos"])
    p["pct_abstencao"] = pct(p["abstencao"], p["eleitorado"])
    p["pct_branco_nulo"] = pct(p["brancos"] + p["nulos"], p["comparecimento"])
    p["margem_votos"] = p[FLAVIO] - p[LULA]  # positivo = Flávio à frente
    p["margem_pp"] = p["pct_flavio"] - p["pct_lula"]
    p["lider"] = np.where(p["margem_votos"] > 0, "Flávio", np.where(p["margem_votos"] < 0, "Lula", "Empate"))

    h = ler("presidente_2022_municipio.csv")
    h22 = {}
    for t in (1, 2):
        x = h[h.turno == t].set_index("cd_tse")
        validos = x.drop(columns=["turno", "uf", "municipio"]).sum(axis=1)
        h22[f"lula_22t{t}"] = x["LULA (PT)"]
        h22[f"bolsonaro_22t{t}"] = x["JAIR BOLSONARO (PL)"]
        h22[f"validos_22t{t}"] = validos
    c = ler("comparecimento_2022_municipio.csv")
    for t in (1, 2):
        x = c[c.turno == t].set_index("cd_tse")
        h22[f"aptos_22t{t}"] = x["aptos"]
        h22[f"abstencao_22t{t}"] = x["abstencao"]
    p = p.join(pd.DataFrame(h22), on="cd_tse")
    for t in (1, 2):
        p[f"pct_lula_22t{t}"] = pct(p[f"lula_22t{t}"], p[f"validos_22t{t}"])
        p[f"pct_abstencao_22t{t}"] = pct(p[f"abstencao_22t{t}"], p[f"aptos_22t{t}"])
    p["var_lula_pp_vs_22t1"] = p["pct_lula"] - p["pct_lula_22t1"]
    p["var_abstencao_pp_vs_22t1"] = p["pct_abstencao"] - p["pct_abstencao_22t1"]

    perfil = ler("perfil_eleitorado_2026_municipio.csv")
    perfil = perfil[["cd_tse", *PERFIL_CHAVE]].rename(columns=PERFIL_CHAVE)
    p = p.merge(perfil, on="cd_tse", how="left")
    return p, elim


def resumo(df, por, elim):
    soma = ["eleitorado", "comparecimento", "abstencao", "brancos", "nulos", "validos",
            FLAVIO, LULA, *elim, "eliminados"]
    g = df.groupby(por)[soma].sum()
    g["% Flávio"] = 100 * g[FLAVIO] / g["validos"]
    g["% Lula"] = 100 * g[LULA] / g["validos"]
    g["margem (votos)"] = g[FLAVIO] - g[LULA]
    g["% abstenção"] = 100 * g["abstencao"] / g["eleitorado"]
    g["% branco+nulo"] = 100 * (g["brancos"] + g["nulos"]) / g["comparecimento"]
    g["votos em disputa"] = g["eliminados"] + g["brancos"] + g["nulos"]
    return g.replace([np.inf, -np.inf], np.nan).round(2)  # grupo sem válidos/eleitorado não vira Infinity no JSON


def transferencia_2022():
    """O que aconteceu do 1º para o 2º turno de 2022 (totais nacionais)."""
    h = ler("presidente_2022_municipio.csv")
    c = ler("comparecimento_2022_municipio.csv")
    t = h.groupby("turno").sum(numeric_only=True)
    a = c.groupby("turno")[["comparecimento", "abstencao", "brancos", "nulos"]].sum()
    elim = t.loc[1].drop(["LULA (PT)", "JAIR BOLSONARO (PL)"])
    tab = pd.DataFrame({
        "1º turno": [t.loc[1, "LULA (PT)"], t.loc[1, "JAIR BOLSONARO (PL)"], elim.sum(),
                     a.loc[1, "brancos"] + a.loc[1, "nulos"], a.loc[1, "abstencao"]],
        "2º turno": [t.loc[2, "LULA (PT)"], t.loc[2, "JAIR BOLSONARO (PL)"], 0,
                     a.loc[2, "brancos"] + a.loc[2, "nulos"], a.loc[2, "abstencao"]],
    }, index=["Lula", "Bolsonaro", "Eliminados", "Brancos e nulos", "Abstenção"]).astype(int)
    tab["variação"] = tab["2º turno"] - tab["1º turno"]
    tab.index.name = "2022"
    detalhe = {k: int(v) for k, v in elim.sort_values(ascending=False).items() if v > 0}
    return tab, detalhe


def perfil_voto(df):
    """Correlação (ponderada pelo eleitorado) entre perfil do município e voto.
    É uma associação entre municípios, não comportamento individual."""
    d = df[(df.uf != "ZZ") & (df.validos > 0)].dropna(subset=list(PERFIL_CHAVE.values()))
    w = d["eleitorado"].values

    def corr(a, b):
        a, b = a - np.average(a, weights=w), b - np.average(b, weights=w)
        return np.sum(w * a * b) / np.sqrt(np.sum(w * a * a) * np.sum(w * b * b))

    linhas = []
    for v in PERFIL_CHAVE.values():
        linhas.append({
            "característica": v,
            "corr. % Lula": corr(d[v].values, d["pct_lula"].values),
            "corr. % Flávio": corr(d[v].values, d["pct_flavio"].values),
            "corr. % abstenção": corr(d[v].values, d["pct_abstencao"].values),
            "corr. % eliminados": corr(d[v].values, d["pct_eliminados"].values),
        })
    corr_tab = pd.DataFrame(linhas).round(3)

    faixas = {}
    for v in ["% ensino superior", "% 60-69 anos", "% 18-24 anos", "% mulheres", "% até fundamental"]:
        q = pd.qcut(d[v].rank(method="first"), 5, labels=["1 (menor)", "2", "3", "4", "5 (maior)"])
        g = d.groupby(q, observed=True).agg(
            faixa_min=(v, "min"), faixa_max=(v, "max"), municipios=("cd_tse", "count"),
            eleitorado=("eleitorado", "sum"), validos=("validos", "sum"),
            flavio=(FLAVIO, "sum"), lula=(LULA, "sum"), eliminados=("eliminados", "sum"),
            abstencao=("abstencao", "sum"))
        g["% Flávio"] = 100 * g.flavio / g.validos
        g["% Lula"] = 100 * g.lula / g.validos
        g["% eliminados"] = 100 * g.eliminados / g.validos
        g["% abstenção"] = 100 * g.abstencao / g.eleitorado
        faixas[v] = g.round(2)
    return corr_tab, faixas


def municipios_chave(df, n=100):
    d = df[df.uf != "ZZ"].copy()
    d["votos em disputa"] = d["eliminados"] + d["brancos"] + d["nulos"]
    cols = ["uf", "municipio", "regiao", "eleitorado", "pct_flavio", "pct_lula", "margem_votos",
            "eliminados", "votos em disputa", "abstencao", "pct_abstencao", "pct_lula_22t2"]
    return {
        "Maior volume em disputa": d.nlargest(n, "votos em disputa")[cols],
        "Maior abstenção (absoluta)": d.nlargest(n, "abstencao")[cols],
        "Disputa apertada: mais de 50 mil eleitores e margem menor que 5 p.p.":
            d[(d.eleitorado > 50_000) & (d.margem_pp.abs() < 5)].sort_values("eleitorado", ascending=False)[cols],
        "Lula venceu em 2022 (2º t.) e está atrás em 2026":
            d[(d.pct_lula_22t2 > 50) & (d.margem_votos > 0)].nlargest(n, "eleitorado")[cols],
        "Bolsonaro venceu em 2022 (2º t.) e Flávio está atrás em 2026":
            d[(d.pct_lula_22t2 < 50) & (d.margem_votos < 0)].nlargest(n, "eleitorado")[cols],
    }


def governadores():
    g = ler("governador_1t_2026_municipio.csv")
    g22 = ler("governador_2022_municipio.csv")
    res, muns = [], []
    # só as UFs que o TSE lista no 2º turno de governador (coleta grava em coleta_1t_meta.json); ex.: RJ saiu da lista
    try:
        with open(f"{T}/coleta_1t_meta.json", encoding="utf-8") as f:
            ufs_2t = set(json.load(f)["ufs_gov_2t"])
    except (FileNotFoundError, KeyError):
        ufs_2t = set(GOV_2T)
    for uf, (a, b) in GOV_2T.items():
        if uf not in ufs_2t:
            print(f"aviso: {uf} não está no 2º turno de governador segundo o TSE; ignorado")
            continue
        x = g[g.uf == uf].copy()
        cands = [c for c in x.columns if "(" in c and x[c].sum() > 0]
        elim = [c for c in cands if c not in (a, b)]
        tot = x[["eleitorado", "comparecimento", "abstencao", "brancos", "nulos", "validos", *cands]].sum()
        res.append({
            "uf": uf, "1º colocado": a, "2º colocado": b,
            "votos 1º": int(tot[a]), "votos 2º": int(tot[b]),
            "% 1º": round(100 * tot[a] / tot.validos, 2), "% 2º": round(100 * tot[b] / tot.validos, 2),
            "eliminados": int(tot[elim].sum()),
            "principais eliminados": "; ".join(f"{c} {100*tot[c]/tot.validos:.1f}%"
                                               for c in sorted(elim, key=lambda c: -tot[c])[:3]),
            "brancos+nulos": int(tot.brancos + tot.nulos), "abstenção": int(tot.abstencao),
            "eleitorado": int(tot.eleitorado), "validos": int(tot.validos),
            "elim_detalhe": {c: int(tot[c]) for c in elim},
        })
        x["pct_1o"] = pct(x[a], x["validos"])
        x["pct_2o"] = pct(x[b], x["validos"])
        x["eliminados"] = x[elim].sum(axis=1)
        x["pct_abstencao"] = pct(x["abstencao"], x["eleitorado"])
        muns.append(x[["uf", "cd_tse", "municipio", "eleitorado", a, b, "pct_1o", "pct_2o",
                       "eliminados", "abstencao", "pct_abstencao"]]
                    .rename(columns={a: "votos_1o", b: "votos_2o"}))
    return pd.DataFrame(res), pd.concat(muns)


if __name__ == "__main__":
    base, elim = base_municipal()
    base.to_csv(f"{T}/base_municipal_2026.csv", sep=";", index=False, encoding="utf-8-sig")

    br = resumo(base.assign(br="Brasil"), "br", elim)
    por_reg = resumo(base, "regiao", elim)
    por_uf = resumo(base, "uf", elim)
    transf, elim22 = transferencia_2022()
    corr_tab, faixas = perfil_voto(base)
    chave = municipios_chave(base)
    gov, gov_mun = governadores()

    # Comparação por UF com 2022
    c22 = base.groupby("uf")[["lula_22t1", "lula_22t2", "validos_22t1", "validos_22t2",
                              "abstencao_22t1", "abstencao_22t2", "aptos_22t1", "aptos_22t2"]].sum()
    por_uf["% Lula 22 T1"] = (100 * c22.lula_22t1 / c22.validos_22t1).round(2)
    por_uf["% Lula 22 T2"] = (100 * c22.lula_22t2 / c22.validos_22t2).round(2)
    por_uf["% abstenção 22 T1"] = (100 * c22.abstencao_22t1 / c22.aptos_22t1).round(2)
    por_uf["% abstenção 22 T2"] = (100 * c22.abstencao_22t2 / c22.aptos_22t2).round(2)

    with pd.ExcelWriter(f"{T}/analise_2turno_2026.xlsx") as xw:
        pd.DataFrame({
            "Aba": ["Brasil", "Regiões", "UFs", "Transferência 2022", "Perfil x voto",
                    "Faixas - *", "Chave - *", "Governadores", "Governador municípios", "Base municipal"],
            "Conteúdo": [
                "Resultado nacional do 1º turno e votos em disputa",
                "Resultado por região",
                "Resultado por UF, comparado com 2022",
                "O que mudou do 1º para o 2º turno de 2022 (totais nacionais)",
                "Correlação entre perfil do eleitorado do município e voto (associação entre municípios, não individual)",
                "Municípios divididos em 5 faixas de cada característica e como votaram",
                "Listas de municípios estratégicos",
                "Governador: 7 estados com 2º turno",
                "Governador por município nos 7 estados",
                "Tudo por município: resultado 2026, 2022 e perfil",
            ],
        }).to_excel(xw, "Leia-me", index=False)
        br.T.to_excel(xw, "Brasil")
        por_reg.to_excel(xw, "Regiões")
        por_uf.to_excel(xw, "UFs")
        transf.to_excel(xw, "Transferência 2022")
        corr_tab.to_excel(xw, "Perfil x voto", index=False)
        for k, v in faixas.items():
            v.to_excel(xw, f"Faixas - {k[2:]}"[:31])
        abas = ["Chave - mais votos em disputa", "Chave - maior abstenção", "Chave - disputa apertada",
                "Chave - Lula perdeu vs 2022", "Chave - Flávio perdeu vs 2022"]
        for aba, (titulo, v) in zip(abas, chave.items()):
            v.to_excel(xw, aba, index=False, startrow=1)
            xw.sheets[aba]["A1"] = titulo
        gov.drop(columns="elim_detalhe").to_excel(xw, "Governadores", index=False)
        gov_mun.to_excel(xw, "Governador municípios", index=False)
        base.to_excel(xw, "Base municipal", index=False)

    # ---------- dados do painel
    cand_elim = {c: int(base[c].sum()) for c in sorted(elim, key=lambda c: -base[c].sum())}
    uf_json = []
    for uf, r in por_uf.iterrows():
        uf_json.append({
            "uf": uf, "regiao": UF_REGIAO[uf], "eleitorado": int(r.eleitorado),
            "comparecimento": int(r.comparecimento), "abstencao": int(r.abstencao),
            "brancos": int(r.brancos), "nulos": int(r.nulos), "validos": int(r.validos),
            "flavio": int(r[FLAVIO]), "lula": int(r[LULA]),
            "elim": {c: int(r[c]) for c in cand_elim},
            "lula22t1": float(r["% Lula 22 T1"]), "lula22t2": float(r["% Lula 22 T2"]),
            "abst22t1": float(r["% abstenção 22 T1"]), "abst22t2": float(r["% abstenção 22 T2"]),
        })
    mun_cols = ["uf", "municipio", "eleitorado", "abstencao", "brancos", "nulos", "validos",
                FLAVIO, LULA, "eliminados", "pct_lula_22t2", *PERFIL_CHAVE.values()]
    mun = base[base.uf != "ZZ"][mun_cols].copy()
    mun.columns = ["uf", "nome", "el", "ab", "br", "nu", "va", "fl", "lu", "el_c", "l22",
                   *[f"p{i}" for i in range(len(PERFIL_CHAVE))]]
    painel = {
        "atualizado": atualizado_texto(),
        "candidatos_eliminados": cand_elim,
        "brasil": {k: int(br.iloc[0][c]) for k, c in [
            ("eleitorado", "eleitorado"), ("comparecimento", "comparecimento"), ("abstencao", "abstencao"),
            ("brancos", "brancos"), ("nulos", "nulos"), ("validos", "validos"), ("flavio", FLAVIO),
            ("lula", LULA), ("eliminados", "eliminados")]},
        "ufs": uf_json,
        "transicao_2022": {i: {k: int(v) for k, v in r.items()} for i, r in transf.iterrows()},
        "eliminados_2022": elim22,
        "perfil_corr": corr_tab.to_dict(orient="records"),
        "faixas": {k: [{"faixa": str(i), **{c: (float(x) if isinstance(x, (float, np.floating)) else int(x))
                                             for c, x in row.items()}}
                       for i, row in v.iterrows()] for k, v in faixas.items()},
        "perfil_rotulos": list(PERFIL_CHAVE.values()),
        "municipios": json.loads(mun.round(2).to_json(orient="values", force_ascii=False)),
        "governadores": [{k: v for k, v in g.items()} for g in gov.to_dict(orient="records")],
    }
    with open(f"{T}/painel_dados.json", "w", encoding="utf-8") as f:
        json.dump(painel, f, ensure_ascii=False, separators=(",", ":"))

    print(br.T.to_string())
    print("\n2022, 1º -> 2º turno:\n", transf.to_string())
    print("\n", corr_tab.to_string())
    print("\n", gov.drop(columns="elim_detalhe").to_string())
