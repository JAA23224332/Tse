"""Balanço do 2º turno: o que aconteceu do 1º para o 2º turno de 2026, por município e por UF.

Só roda quando dados/tratados/presidente_2t_2026_municipio.csv existe (coleta_resultados_2026.py --turno 2).
Compara com as premissas do motor de estratégia: quanto dos votos dos eliminados foi para cada lado,
quanto a abstenção mudou, onde Lula ganhou/perdeu mais e como a projeção da noite se saiu.

Saídas em dados/tratados/: balanco_2t_municipio.csv, balanco_2t_uf.csv, balanco_2t_2026.xlsx, balanco_2t_dados.json
"""

import json

import numpy as np
import pandas as pd

T = "dados/tratados"
FL, LU = "FLAVIO BOLSONARO (PL)", "LULA (PT)"
CHAVE = ["uf", "cd_tse", "municipio"]


def ler(nome):
    return pd.read_csv(f"{T}/{nome}", sep=";", dtype={"cd_tse": str, "cd_ibge": str})


def pct(a, b):
    return np.where(b > 0, 100 * a / b, np.nan)


if __name__ == "__main__":
    t1 = ler("presidente_1t_2026_municipio.csv")
    t2 = ler("presidente_2t_2026_municipio.csv")
    elim_cols = [c for c in t1.columns if "(" in c and c not in (FL, LU)]
    a = t1[CHAVE + ["eleitorado", "comparecimento", "abstencao", "brancos", "nulos", "validos", LU, FL]].copy()
    a["eliminados"] = t1[elim_cols].sum(axis=1)
    b = t2[["cd_tse", "eleitorado", "comparecimento", "abstencao", "brancos", "nulos", "validos", LU, FL]].rename(
        columns=lambda c: c if c == "cd_tse" else f"{c}_2t")
    d = a.merge(b, on="cd_tse", how="outer", indicator=True)
    so_um = d[d._merge != "both"]
    if len(so_um):
        print(f"aviso: {len(so_um)} municípios só em um dos turnos (fora dos totais):", so_um.cd_tse.tolist()[:10])
    d = d[d._merge == "both"].drop(columns="_merge").copy()

    # o que mudou
    d["pct_lula_1t"] = pct(d[LU], d[LU] + d[FL]);          d["pct_lula_2t"] = pct(d[f"{LU}_2t"], d[f"{LU}_2t"] + d[f"{FL}_2t"])
    d["swing_lula_pp"] = d.pct_lula_2t - d.pct_lula_1t     # mudança da fatia de Lula entre os dois (pontos)
    d["ganho_lula"] = d[f"{LU}_2t"] - d[LU];                d["ganho_flavio"] = d[f"{FL}_2t"] - d[FL]
    d["var_comparecimento"] = d.comparecimento_2t - d.comparecimento
    d["var_brancos_nulos"] = (d.brancos_2t + d.nulos_2t) - (d.brancos + d.nulos)
    d["pct_abst_1t"] = pct(d.abstencao, d.eleitorado);     d["pct_abst_2t"] = pct(d.abstencao_2t, d.eleitorado_2t)
    # decomposição: os votos novos de cada lado vieram de eliminados + variação de comparecimento + brancos/nulos
    pool = d.eliminados + d.var_comparecimento - d.var_brancos_nulos
    d["pool_disponivel"] = pool
    d["parcela_lula_do_pool"] = pct(d.ganho_lula, pool)
    d["parcela_flavio_do_pool"] = pct(d.ganho_flavio, pool)
    quem = lambda l, f: np.select([l > f, f > l], ["Lula", "Flávio"], default="Empate")
    d["vencedor_1t"] = quem(d[LU], d[FL]);  d["vencedor_2t"] = quem(d[f"{LU}_2t"], d[f"{FL}_2t"])
    d["virou"] = d.vencedor_1t != d.vencedor_2t

    por_uf = d.groupby("uf").agg(municipios=("cd_tse", "count"), eleitorado=("eleitorado_2t", "sum"),
        lula_1t=(LU, "sum"), flavio_1t=(FL, "sum"), lula_2t=(f"{LU}_2t", "sum"), flavio_2t=(f"{FL}_2t", "sum"),
        eliminados=("eliminados", "sum"), ganho_lula=("ganho_lula", "sum"), ganho_flavio=("ganho_flavio", "sum"),
        abst_1t=("abstencao", "sum"), abst_2t=("abstencao_2t", "sum"), virou=("virou", "sum"))
    por_uf["pct_lula_1t"] = pct(por_uf.lula_1t, por_uf.lula_1t + por_uf.flavio_1t)
    por_uf["pct_lula_2t"] = pct(por_uf.lula_2t, por_uf.lula_2t + por_uf.flavio_2t)
    por_uf["swing_lula_pp"] = por_uf.pct_lula_2t - por_uf.pct_lula_1t
    por_uf["pct_abst_1t"] = pct(por_uf.abst_1t, por_uf.eleitorado); por_uf["pct_abst_2t"] = pct(por_uf.abst_2t, por_uf.eleitorado)
    por_uf = por_uf.sort_values("eleitorado", ascending=False).round(2)

    brasil = {
        "lula_1t": int(d[LU].sum()), "flavio_1t": int(d[FL].sum()), "lula_2t": int(d[f"{LU}_2t"].sum()), "flavio_2t": int(d[f"{FL}_2t"].sum()),
        "eliminados_1t": int(d.eliminados.sum()), "ganho_lula": int(d.ganho_lula.sum()), "ganho_flavio": int(d.ganho_flavio.sum()),
        "abst_1t": int(d.abstencao.sum()), "abst_2t": int(d.abstencao_2t.sum()), "municipios_viraram": int(d.virou.sum()),
    }
    brasil["parcela_lula_do_crescimento_pct"] = round(100 * brasil["ganho_lula"] / max(1, brasil["ganho_lula"] + brasil["ganho_flavio"]), 1)

    # comparação com as premissas do motor (o que a campanha supôs × o que aconteceu), na mesma régua:
    # saldo_liquido (o que Lula ganha menos o que Flávio ganha) × ganho real líquido; ganho_total é só o potencial bruto de Lula
    try:
        est = ler("estrategia_municipio.csv")[["cd_tse", "ganho_total", "saldo_liquido", "territorio"]]
        d = d.merge(est, on="cd_tse", how="left")
        d["ganho_liquido_real"] = d.ganho_lula - d.ganho_flavio
        premissa_vs_real = {"saldo_liquido_previsto": int(est.saldo_liquido.sum()), "ganho_liquido_real": int(d.ganho_liquido_real.sum()),
                            "potencial_bruto_lula_previsto": int(est.ganho_total.sum())}
        pesos = d.eleitorado.clip(lower=1)
        por_terr = d.groupby("territorio").agg(municipios=("cd_tse", "count"), previsto=("saldo_liquido", "sum"), real=("ganho_liquido_real", "sum"),
                                                potencial_bruto=("ganho_total", "sum"))
        por_terr["swing_medio_pp"] = (d.swing_lula_pp.fillna(0) * pesos).groupby(d.territorio).sum() / pesos.groupby(d.territorio).sum()  # ponderado pelo eleitorado
        por_terr = por_terr.round(1)
    except FileNotFoundError:
        premissa_vs_real, por_terr = {}, pd.DataFrame()

    cols = CHAVE + ["eleitorado", "pct_lula_1t", "pct_lula_2t", "swing_lula_pp", LU, FL, f"{LU}_2t", f"{FL}_2t", "eliminados",
                    "ganho_lula", "ganho_flavio", "pool_disponivel", "parcela_lula_do_pool", "parcela_flavio_do_pool",
                    "pct_abst_1t", "pct_abst_2t", "var_comparecimento", "var_brancos_nulos", "vencedor_1t", "vencedor_2t", "virou"]
    cols += [c for c in ["territorio", "ganho_total", "saldo_liquido", "ganho_liquido_real"] if c in d]
    out = d[cols].round(2).sort_values("eleitorado", ascending=False)
    out.to_csv(f"{T}/balanco_2t_municipio.csv", sep=";", index=False, encoding="utf-8-sig")
    por_uf.to_csv(f"{T}/balanco_2t_uf.csv", sep=";", encoding="utf-8-sig")
    with pd.ExcelWriter(f"{T}/balanco_2t_2026.xlsx") as xw:
        pd.Series(brasil | premissa_vs_real).to_excel(xw, "Brasil")
        por_uf.to_excel(xw, "Por UF")
        if len(por_terr): por_terr.to_excel(xw, "Por território")
        out[out.virou].to_excel(xw, "Municípios que viraram", index=False)
        out.nlargest(300, "eleitorado").to_excel(xw, "300 maiores", index=False)
        out.to_excel(xw, "Todos", index=False)
    with open(f"{T}/balanco_2t_dados.json", "w", encoding="utf-8") as f:
        json.dump({"brasil": brasil, "premissa_vs_real": premissa_vs_real, "ufs": por_uf.reset_index().to_dict(orient="records"),
                   "territorios": por_terr.reset_index().to_dict(orient="records") if len(por_terr) else []}, f, ensure_ascii=False)
    print(json.dumps(brasil, ensure_ascii=False, indent=1)); print(por_uf[["pct_lula_1t", "pct_lula_2t", "swing_lula_pp", "virou"]].head(10))
