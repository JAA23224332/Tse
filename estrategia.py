"""Motor de estratégia do 2º turno para a campanha de Lula.

Para cada município calcula onde há voto a buscar e por qual caminho:
  mobilizar  — reduzir abstenção onde Lula já é maioria (cada eleitor a mais é voto líquido)
  recuperar  — onde Lula caiu em relação ao 2º turno de 2022
  persuadir  — votos de candidatos eliminados, brancos e nulos
  defender   — redutos onde a margem é grande e a abstenção também

Premissas de transferência ficam em PREMISSAS e podem ser mudadas no site.

Entrada: dados/tratados/base_municipal_2026.csv (gerado por analise_2turno.py)
Saídas:  dados/tratados/estrategia_municipio.csv, estrategia_uf.csv,
         estrategia_dados.json (para o site) e aba na planilha estrategia_lula_2026.xlsx
"""

import json

import numpy as np
import pandas as pd

T = "dados/tratados"
FL, LU = "FLAVIO BOLSONARO (PL)", "LULA (PT)"

# Fração dos votos de cada eliminado que a campanha considera possível trazer para Lula.
# São hipóteses de trabalho, não dados: ajuste conforme pesquisas e acordos.
PREMISSAS = {
    "transferencia": {
        "ESCRITOR AUGUSTO CURY (AVANTE)": 0.35,
        "RENAN SANTOS (MISSÃO)": 0.10,
        "RONALDO CAIADO (PSD)": 0.15,
        "ZEMA (NOVO)": 0.05,
        "SAMARA (UP)": 0.85,
        "HERTZ DIAS (PSTU)": 0.85,
        "EDMILSON COSTA (PCB)": 0.85,
        "RUI COSTA PIMENTA (PCO)": 0.85,
        "CLARIANA BARAO (DC)": 0.20,
        "VETERINÁRIO WILSON GRASSI (DEMOCRATA)": 0.20,
    },
    "brancos_nulos": 0.15,       # fração de brancos/nulos convertível em voto
    "queda_abstencao_pp": 2.0,   # pontos de abstenção que a mobilização pode derrubar em reduto
    "recuperacao_2022": 0.5,     # fração da perda vs 2022 que dá para recuperar
}


def carregar():
    df = pd.read_csv(f"{T}/base_municipal_2026.csv", sep=";", dtype={"cd_tse": str, "cd_ibge": str})
    return df[df.uf != "ZZ"].copy()


def calcular(df, p=PREMISSAS):
    d = df.copy()
    d["margem_lula"] = d[LU] - d[FL]                       # positivo = Lula à frente
    d["margem_lula_pp"] = d["pct_lula"] - d["pct_flavio"]
    d["lula_lidera"] = d["margem_lula"] > 0

    # 1. Mobilizar: queda de X pp na abstenção em lugares onde Lula lidera.
    #    Novos votantes seguem a proporção local; o ganho líquido é a margem local sobre eles.
    novos = d["eleitorado"] * p["queda_abstencao_pp"] / 100
    d["ganho_mobilizar"] = np.where(d.lula_lidera, novos * d["margem_lula_pp"] / 100, 0.0)
    d["ganho_mobilizar_1pp"] = np.where(d.lula_lidera, d["eleitorado"] / 100 * d["margem_lula_pp"] / 100, 0.0)

    # 2. Recuperar: perda de share vs 1º turno de 2022 (mesma régua: 1º turno com 1º turno).
    perda_pp = (d["pct_lula_22t1"] - d["pct_lula"]).clip(lower=0).fillna(0)
    d["perda_vs_2022_votos"] = perda_pp / 100 * d["validos"]
    d["ganho_recuperar"] = d["perda_vs_2022_votos"] * p["recuperacao_2022"]

    # 3. Persuadir: eliminados (com premissa por candidato) + brancos e nulos.
    d["ganho_eliminados"] = sum(d[c].fillna(0) * f for c, f in p["transferencia"].items() if c in d)
    d["ganho_brancos_nulos"] = (d["brancos"] + d["nulos"]) * p["brancos_nulos"]
    d["ganho_persuadir"] = d["ganho_eliminados"] + d["ganho_brancos_nulos"]

    d["ganho_total"] = d["ganho_mobilizar"] + d["ganho_recuperar"] + d["ganho_persuadir"]
    d["ganho_por_mil_eleitores"] = 1000 * d["ganho_total"] / d["eleitorado"]

    # Risco: redutos de Lula com abstenção alta são onde o adversário mais ganha se mobilizar... e onde
    # um esforço de defesa rende mais. Redutos de Flávio com abstenção alta são o risco inverso.
    d["abst_acima_media"] = d["pct_abstencao"] - np.average(d["pct_abstencao"], weights=d["eleitorado"])

    # Território: o que define a tática é a margem local.
    d["territorio"] = np.select(
        [d.margem_lula_pp >= 15, d.margem_lula_pp <= -15], ["Reduto de Lula", "Reduto de Flávio"], "Disputado")
    d["caiu_vs_2022"] = perda_pp >= 3

    def classificar(r):
        if r.territorio == "Reduto de Lula":
            return "Mobilizar (reduzir abstenção)"
        if r.territorio == "Disputado":
            return "Persuadir (eliminados, brancos e nulos)" if not r.caiu_vs_2022 else "Recuperar e persuadir"
        return "Limitar perdas" if r.ganho_persuadir < 0.02 * r.validos else "Buscar eliminados"
    d["acao"] = d.apply(classificar, axis=1)
    d["rank_ganho"] = d["ganho_total"].rank(ascending=False, method="first").astype(int)
    d["rank_eficiencia"] = d["ganho_por_mil_eleitores"].rank(ascending=False, method="first").astype(int)
    return d


def por_uf(d):
    g = d.groupby("uf").agg(
        regiao=("regiao", "first"), municipios=("cd_tse", "count"), eleitorado=("eleitorado", "sum"),
        lula=(LU, "sum"), flavio=(FL, "sum"), validos=("validos", "sum"), abstencao=("abstencao", "sum"),
        ganho_mobilizar=("ganho_mobilizar", "sum"), ganho_recuperar=("ganho_recuperar", "sum"),
        ganho_persuadir=("ganho_persuadir", "sum"), ganho_total=("ganho_total", "sum"),
        perda_vs_2022=("perda_vs_2022_votos", "sum"),
    )
    g["margem_lula"] = g.lula - g.flavio
    g["pct_lula"] = 100 * g.lula / g.validos
    g["pct_abstencao"] = 100 * g.abstencao / g.eleitorado
    g["ganho_por_mil"] = 1000 * g.ganho_total / g.eleitorado
    g["peso_nacional_pct"] = 100 * g.eleitorado / g.eleitorado.sum()
    g["share_do_ganho_pct"] = 100 * g.ganho_total / g.ganho_total.sum()
    return g.sort_values("ganho_total", ascending=False).round(1)


def caminho_da_virada(d, deficit):
    """Quanto cada alavanca rende com as premissas e quanto falta."""
    alav = {
        "Mobilizar redutos (abstenção −%.0f p.p.)" % PREMISSAS["queda_abstencao_pp"]: d.ganho_mobilizar.sum(),
        "Recuperar perdas de 2022 (%.0f%%)" % (100 * PREMISSAS["recuperacao_2022"]): d.ganho_recuperar.sum(),
        "Votos de eliminados (premissas por candidato)": d.ganho_eliminados.sum(),
        "Brancos e nulos (%.0f%%)" % (100 * PREMISSAS["brancos_nulos"]): d.ganho_brancos_nulos.sum(),
    }
    total = sum(alav.values())
    # os votos de eliminados que vão para Flávio reduzem o saldo: estimativa espelho com 1 - premissa
    contra = sum(d[c].sum() * (1 - f) * 0.6 for c, f in PREMISSAS["transferencia"].items() if c in d)
    return {"alavancas": {k: int(v) for k, v in alav.items()}, "ganho_bruto": int(total),
            "ganho_flavio_estimado": int(contra), "deficit": int(deficit),
            "saldo_projetado": int(total - contra - deficit)}


if __name__ == "__main__":
    base = carregar()
    d = calcular(base)
    deficit = int((d[FL] - d[LU]).sum() + 0)  # exterior fora; difere do nacional em ~13 mil
    uf = por_uf(d)
    virada = caminho_da_virada(d, 2_224_965)

    cols = ["uf", "cd_tse", "cd_ibge", "municipio", "regiao", "capital", "eleitorado", "comparecimento", "abstencao",
            "pct_abstencao", "validos", LU, FL, "pct_lula", "pct_flavio", "margem_lula", "margem_lula_pp",
            "pct_lula_22t1", "pct_lula_22t2", "perda_vs_2022_votos", "territorio", "caiu_vs_2022", "eliminados", "brancos", "nulos",
            "ganho_mobilizar", "ganho_mobilizar_1pp", "ganho_recuperar", "ganho_eliminados", "ganho_brancos_nulos",
            "ganho_persuadir", "ganho_total", "ganho_por_mil_eleitores", "acao", "rank_ganho", "rank_eficiencia",
            "% mulheres", "% 18-24 anos", "% 60-69 anos", "% ensino superior", "% até fundamental"]
    out = d[cols].sort_values("rank_ganho").round(1)
    out.to_csv(f"{T}/estrategia_municipio.csv", sep=";", index=False, encoding="utf-8-sig")
    uf.to_csv(f"{T}/estrategia_uf.csv", sep=";", encoding="utf-8-sig")

    with pd.ExcelWriter(f"{T}/estrategia_lula_2026.xlsx") as xw:
        pd.DataFrame({"Premissa": list(PREMISSAS["transferencia"]) + ["brancos/nulos", "queda abstenção (p.p.)", "recuperação 2022"],
                      "Valor": list(PREMISSAS["transferencia"].values()) + [PREMISSAS["brancos_nulos"], PREMISSAS["queda_abstencao_pp"], PREMISSAS["recuperacao_2022"]]}
                     ).to_excel(xw, "Premissas", index=False)
        pd.Series(virada["alavancas"] | {"Ganho bruto": virada["ganho_bruto"], "Ganho estimado de Flávio": virada["ganho_flavio_estimado"],
                  "Déficit do 1º turno": virada["deficit"], "Saldo projetado": virada["saldo_projetado"]}, name="votos").to_excel(xw, "Caminho da virada")
        uf.to_excel(xw, "Por UF")
        out.head(500).to_excel(xw, "Top 500 municípios", index=False)
        for terr in ["Reduto de Lula", "Disputado", "Reduto de Flávio"]:
            out[out.territorio == terr].head(300).to_excel(xw, terr, index=False)
        out.to_excel(xw, "Todos os municípios", index=False)

    mun_cols = ["uf", "cd_tse", "municipio", "eleitorado", "pct_lula", "pct_flavio", "margem_lula", "pct_abstencao",
                "pct_lula_22t1", "eliminados", "brancos", "nulos", "ganho_mobilizar", "ganho_recuperar",
                "ganho_persuadir", "ganho_total", "ganho_por_mil_eleitores", "territorio", "acao"]
    painel = {
        "premissas": PREMISSAS, "virada": virada,
        "territorios": d.groupby("territorio").agg(n=("cd_tse", "count"), eleitorado=("eleitorado", "sum"), lula=(LU, "sum"), flavio=(FL, "sum"), abstencao=("abstencao", "sum"), ganho=("ganho_total", "sum")).round(0).reset_index().to_dict(orient="records"),
        "acoes": d.groupby("acao").agg(n=("cd_tse", "count"), eleitorado=("eleitorado", "sum"), ganho=("ganho_total", "sum")).round(0).reset_index().to_dict(orient="records"),
        "ufs": uf.reset_index().to_dict(orient="records"),
        "municipios": json.loads(out[mun_cols].round(1).to_json(orient="values", force_ascii=False)),
        "colunas": mun_cols,
        "eliminados_brasil": {c: int(d[c].sum()) for c in PREMISSAS["transferencia"] if c in d},
    }
    with open(f"{T}/estrategia_dados.json", "w", encoding="utf-8") as f:
        json.dump(painel, f, ensure_ascii=False, separators=(",", ":"))

    print("Caminho da virada:", json.dumps(virada, ensure_ascii=False, indent=1))
    print("\nTerritórios:", d.territorio.value_counts().to_dict(), "\nAções:", d.acao.value_counts().to_dict())
    print("\nTop UFs por ganho:\n", uf[["ganho_total", "ganho_mobilizar", "ganho_recuperar", "ganho_persuadir", "pct_lula", "pct_abstencao"]].head(10))
    print("\nTop 15 municípios:\n", out[["uf", "municipio", "eleitorado", "pct_lula", "pct_abstencao", "ganho_total", "acao"]].head(15).to_string())
