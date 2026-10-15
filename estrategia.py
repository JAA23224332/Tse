"""Motor de estratégia do 2º turno para a campanha de Lula.

Para cada município calcula onde há voto a buscar e por qual caminho, e quanto isso rende em votos
LÍQUIDOS (o que Lula ganha menos o que Flávio ganha com o mesmo movimento):
  mobilizar — queda da abstenção; os novos votantes seguem a proporção local, então rende onde Lula lidera
              e custa onde Flávio lidera (o adversário também mobiliza)
  persuadir — votos de candidatos eliminados e brancos/nulos, com uma fração para cada lado por candidato
"Recuperar o que caiu desde 2022" não é somado: esses eleitores são os mesmos que hoje estão nos eliminados
ou na abstenção; a perda vs 2022 fica como diagnóstico para orientar onde ir.

Premissas (hipóteses de trabalho, não dados) ficam em PREMISSAS e são ajustáveis no site. O "caminho da
virada" é mostrado em três cenários (pessimista, base, otimista) para ninguém tomar uma hipótese por previsão.

Entrada: dados/tratados/base_municipal_2026.csv (gerado por analise_2turno.py)
Saídas:  dados/tratados/estrategia_municipio.csv, estrategia_uf.csv, estrategia_dados.json (site),
         estrategia_lula_2026.xlsx
"""

import json

import numpy as np
import pandas as pd

T = "dados/tratados"
FL, LU = "FLAVIO BOLSONARO (PL)", "LULA (PT)"
LIMIAR_REDUTO_PP = 15  # margem (pontos) a partir da qual um município é reduto de um dos lados

# Para cada eliminado: fração dos votos que vai para Lula e fração que vai para Flávio (o resto fica em casa,
# vota branco/nulo). Campos de direita/centro-direita tendem a Flávio; os pequenos de esquerda, a Lula.
PREMISSAS = {
    "eliminados": {
        "ESCRITOR AUGUSTO CURY (AVANTE)": {"lula": 0.35, "flavio": 0.40},
        "RENAN SANTOS (MISSÃO)": {"lula": 0.10, "flavio": 0.75},
        "RONALDO CAIADO (PSD)": {"lula": 0.15, "flavio": 0.70},
        "ZEMA (NOVO)": {"lula": 0.05, "flavio": 0.85},
        "SAMARA (UP)": {"lula": 0.85, "flavio": 0.03},
        "HERTZ DIAS (PSTU)": {"lula": 0.85, "flavio": 0.03},
        "EDMILSON COSTA (PCB)": {"lula": 0.85, "flavio": 0.03},
        "RUI COSTA PIMENTA (PCO)": {"lula": 0.85, "flavio": 0.03},
        "CLARIANA BARAO (DC)": {"lula": 0.20, "flavio": 0.60},
        "VETERINÁRIO WILSON GRASSI (DEMOCRATA)": {"lula": 0.20, "flavio": 0.60},
    },
    "brancos_nulos": {"lula": 0.15, "flavio": 0.15},
    # queda da abstenção, em pontos do eleitorado, por tipo de território
    "queda_abstencao": {"Reduto de Lula": 2.0, "Disputado": 1.0, "Reduto de Flávio": 2.0},
}
# multiplicadores sobre as premissas: frações para Lula, frações para Flávio, queda em reduto de Lula, queda em reduto de Flávio
CENARIOS = {
    "pessimista": {"lula": 0.7, "flavio": 1.15, "mob_lula": 0.5, "mob_flavio": 1.5},
    "base": {"lula": 1.0, "flavio": 1.0, "mob_lula": 1.0, "mob_flavio": 1.0},
    "otimista": {"lula": 1.3, "flavio": 0.85, "mob_lula": 1.5, "mob_flavio": 0.5},
}


def carregar():
    return pd.read_csv(f"{T}/base_municipal_2026.csv", sep=";", dtype={"cd_tse": str, "cd_ibge": str})


def aplicar_cenario(p, c):
    """Premissas com os multiplicadores de um cenário (frações limitadas para lula + flavio ≤ 1)."""
    m = CENARIOS[c]
    def par(x):
        l, f = min(1.0, x["lula"] * m["lula"]), min(1.0, x["flavio"] * m["flavio"])
        if l + f > 1: f = 1 - l
        return {"lula": l, "flavio": f}
    return {
        "eliminados": {k: par(v) for k, v in p["eliminados"].items()},
        "brancos_nulos": par(p["brancos_nulos"]),
        "queda_abstencao": {"Reduto de Lula": p["queda_abstencao"]["Reduto de Lula"] * m["mob_lula"],
                            "Disputado": p["queda_abstencao"]["Disputado"] * (m["mob_lula"] + m["mob_flavio"]) / 2,
                            "Reduto de Flávio": p["queda_abstencao"]["Reduto de Flávio"] * m["mob_flavio"]},
    }


def calcular(df, p=PREMISSAS):
    d = df.copy()
    d["margem_lula"] = d[LU] - d[FL]
    d["margem_lula_pp"] = d["pct_lula"] - d["pct_flavio"]
    d["territorio"] = np.select([d.margem_lula_pp >= LIMIAR_REDUTO_PP, d.margem_lula_pp <= -LIMIAR_REDUTO_PP],
                                ["Reduto de Lula", "Reduto de Flávio"], "Disputado")

    # 1. Mobilizar: queda da abstenção (por território); novos votantes seguem a proporção local → líquido com sinal
    queda = d["territorio"].map(p["queda_abstencao"]).astype(float)
    novos = d["eleitorado"] * queda / 100
    d["mobilizar_liquido"] = novos * d["margem_lula_pp"] / 100
    d["ganho_mobilizar"] = d["mobilizar_liquido"].clip(lower=0)          # potencial de Lula (onde rende)
    d["ganho_mobilizar_1pp"] = (d["eleitorado"] / 100 * d["margem_lula_pp"] / 100).clip(lower=0)

    # 2. Persuadir: eliminados (fração para cada lado, por candidato) + brancos e nulos
    elim = p["eliminados"]
    d["eliminados_para_lula"] = sum(d[c].fillna(0) * f["lula"] for c, f in elim.items() if c in d)
    d["eliminados_para_flavio"] = sum(d[c].fillna(0) * f["flavio"] for c, f in elim.items() if c in d)
    bn = d["brancos"] + d["nulos"]
    d["bn_para_lula"], d["bn_para_flavio"] = bn * p["brancos_nulos"]["lula"], bn * p["brancos_nulos"]["flavio"]
    d["ganho_persuadir"] = d["eliminados_para_lula"] + d["bn_para_lula"]   # potencial de Lula
    d["persuadir_liquido"] = d["ganho_persuadir"] - d["eliminados_para_flavio"] - d["bn_para_flavio"]

    # potencial (onde Lula tem o que ganhar: orienta o esforço) e saldo líquido (o que muda o placar nacional)
    d["ganho_total"] = d["ganho_mobilizar"] + d["ganho_persuadir"]
    d["saldo_liquido"] = d["mobilizar_liquido"] + d["persuadir_liquido"]
    d["ganho_por_mil_eleitores"] = 1000 * d["ganho_total"] / d["eleitorado"]
    for c in ["mobilizar_liquido", "ganho_mobilizar", "ganho_mobilizar_1pp", "ganho_total", "saldo_liquido", "ganho_por_mil_eleitores"]:
        d[c] = d[c].fillna(0)  # localidades do exterior sem votos válidos

    # Diagnóstico: perda vs 1º turno de 2022 (mesma régua), sem somar ao ganho
    perda_pp = (d["pct_lula_22t1"] - d["pct_lula"]).fillna(0)
    d["perda_vs_2022_votos"] = perda_pp.clip(lower=0) / 100 * d["validos"]
    d["caiu_vs_2022"] = perda_pp >= 3

    def classificar(r):
        if r.territorio == "Reduto de Lula":
            return "Mobilizar (reduzir abstenção)"
        if r.territorio == "Disputado":
            return "Persuadir (eliminados, brancos e nulos)" + (" e recuperar quem saiu desde 2022" if r.caiu_vs_2022 else "")
        return "Limitar perdas" if r.ganho_persuadir < 0.02 * r.validos else "Buscar eliminados"
    d["acao"] = d.apply(classificar, axis=1)
    d["rank_ganho"] = d["ganho_total"].rank(ascending=False, method="first").astype(int)
    d["rank_eficiencia"] = d["ganho_por_mil_eleitores"].rank(ascending=False, method="first").astype(int)
    return d


def por_uf(d):
    g = d[d.uf != "ZZ"].groupby("uf").agg(
        regiao=("regiao", "first"), municipios=("cd_tse", "count"), eleitorado=("eleitorado", "sum"),
        lula=(LU, "sum"), flavio=(FL, "sum"), validos=("validos", "sum"), abstencao=("abstencao", "sum"),
        ganho_mobilizar=("ganho_mobilizar", "sum"), ganho_persuadir=("ganho_persuadir", "sum"), ganho_total=("ganho_total", "sum"),
        saldo_liquido=("saldo_liquido", "sum"), perda_vs_2022=("perda_vs_2022_votos", "sum"),
    )
    g["margem_lula"] = g.lula - g.flavio
    g["pct_lula"] = 100 * g.lula / g.validos
    g["pct_abstencao"] = 100 * g.abstencao / g.eleitorado
    g["ganho_por_mil"] = 1000 * g.ganho_total / g.eleitorado
    g["peso_nacional_pct"] = 100 * g.eleitorado / g.eleitorado.sum()
    g["share_do_ganho_pct"] = 100 * g.ganho_total / g.ganho_total.sum()
    return g.sort_values("ganho_total", ascending=False).round(1)


def caminho_da_virada(base):
    """Déficit do 1º turno (com exterior) e saldo líquido em três cenários."""
    deficit = int((base[FL] - base[LU]).sum())
    cen = {}
    for nome in CENARIOS:
        d = calcular(base, aplicar_cenario(PREMISSAS, nome))
        cen[nome] = {
            "mobilizar_liquido": int(d.mobilizar_liquido.sum()),
            "eliminados_lula": int(d.eliminados_para_lula.sum()), "eliminados_flavio": int(d.eliminados_para_flavio.sum()),
            "bn_lula": int(d.bn_para_lula.sum()), "bn_flavio": int(d.bn_para_flavio.sum()),
            "saldo_liquido": int(d.saldo_liquido.sum()),
            "resultado": int(d.saldo_liquido.sum() - deficit),  # positivo = Lula passa à frente
        }
    return {"deficit": deficit, "cenarios": cen}


if __name__ == "__main__":
    base = carregar()
    d = calcular(base)
    virada = caminho_da_virada(base)
    uf = por_uf(d)
    elim_cols = [c for c in PREMISSAS["eliminados"] if c in d]

    cols = ["uf", "cd_tse", "cd_ibge", "municipio", "regiao", "capital", "eleitorado", "comparecimento", "abstencao",
            "pct_abstencao", "validos", LU, FL, *elim_cols, "pct_lula", "pct_flavio", "margem_lula", "margem_lula_pp",
            "pct_lula_22t1", "pct_lula_22t2", "perda_vs_2022_votos", "territorio", "caiu_vs_2022", "eliminados", "brancos", "nulos",
            "ganho_mobilizar", "ganho_mobilizar_1pp", "mobilizar_liquido", "eliminados_para_lula", "eliminados_para_flavio",
            "bn_para_lula", "bn_para_flavio", "ganho_persuadir", "persuadir_liquido", "ganho_total", "saldo_liquido",
            "ganho_por_mil_eleitores", "acao", "rank_ganho", "rank_eficiencia",
            "% mulheres", "% 18-24 anos", "% 60-69 anos", "% ensino superior", "% até fundamental"]
    out = d[cols].sort_values("rank_ganho").round(1)
    out.to_csv(f"{T}/estrategia_municipio.csv", sep=";", index=False, encoding="utf-8-sig")
    uf.to_csv(f"{T}/estrategia_uf.csv", sep=";", encoding="utf-8-sig")

    prem = pd.DataFrame([{"premissa": k, "para Lula": v["lula"], "para Flávio": v["flavio"]} for k, v in PREMISSAS["eliminados"].items()]
                        + [{"premissa": "brancos e nulos", **{"para Lula": PREMISSAS["brancos_nulos"]["lula"], "para Flávio": PREMISSAS["brancos_nulos"]["flavio"]}}]
                        + [{"premissa": f"queda da abstenção em {k} (pontos)", "para Lula": v} for k, v in PREMISSAS["queda_abstencao"].items()])
    cen = pd.DataFrame(virada["cenarios"]).T
    cen.loc["déficit do 1º turno (com exterior)", "resultado"] = -virada["deficit"]
    with pd.ExcelWriter(f"{T}/estrategia_lula_2026.xlsx") as xw:
        prem.to_excel(xw, "Premissas", index=False)
        cen.to_excel(xw, "Caminho da virada")
        uf.to_excel(xw, "Por UF")
        out[out.uf != "ZZ"].head(500).to_excel(xw, "Top 500 municípios", index=False)
        for terr in ["Reduto de Lula", "Disputado", "Reduto de Flávio"]:
            out[(out.territorio == terr) & (out.uf != "ZZ")].head(300).to_excel(xw, terr, index=False)
        out.to_excel(xw, "Todos os municípios", index=False)

    mun_cols = ["uf", "cd_tse", "municipio", "eleitorado", "pct_lula", "pct_flavio", "margem_lula", "pct_abstencao",
                "pct_lula_22t1", "eliminados", "brancos", "nulos", *elim_cols, "territorio", "acao", "caiu_vs_2022", "perda_vs_2022_votos"]
    mun = out[mun_cols].copy()
    mun["caiu_vs_2022"] = mun["caiu_vs_2022"].astype(int)
    painel = {
        "premissas": PREMISSAS, "cenarios": CENARIOS, "limiar_reduto_pp": LIMIAR_REDUTO_PP, "virada": virada,
        "territorios": d[d.uf != "ZZ"].groupby("territorio").agg(n=("cd_tse", "count"), eleitorado=("eleitorado", "sum"), lula=(LU, "sum"), flavio=(FL, "sum"), abstencao=("abstencao", "sum")).round(0).reset_index().to_dict(orient="records"),
        "ufs": uf.reset_index().to_dict(orient="records"),
        "municipios": json.loads(mun.round(1).to_json(orient="values", force_ascii=False)),
        "colunas": mun_cols, "eliminados_cols": elim_cols,
        "eliminados_brasil": {c: int(d[c].sum()) for c in elim_cols},
    }
    with open(f"{T}/estrategia_dados.json", "w", encoding="utf-8") as f:
        json.dump(painel, f, ensure_ascii=False, separators=(",", ":"))

    print("Déficit do 1º turno:", f"{virada['deficit']:,}")
    for k, v in virada["cenarios"].items():
        print(f"  {k:10} saldo líquido {v['saldo_liquido']:>+12,} → resultado {v['resultado']:>+12,}")
    print("\nTerritórios:", d[d.uf != "ZZ"].territorio.value_counts().to_dict())
    print("\nTop UFs por potencial:\n", uf[["ganho_total", "saldo_liquido", "ganho_mobilizar", "ganho_persuadir", "pct_lula", "pct_abstencao"]].head(8))
    print("\nTop 10 municípios por potencial:\n", out[out.uf != "ZZ"][["uf", "municipio", "eleitorado", "pct_lula", "ganho_total", "saldo_liquido", "acao"]].head(10).to_string())
