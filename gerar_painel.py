"""Monta painel/painel_2turno.html (arquivo HTML independente, abre direto no navegador)
a partir do template, da identidade visual compartilhada e de dados/tratados/painel_dados.json."""

from identidade import CSS, FONTS, TILES_JS, escrever_globals

with open("dados/tratados/painel_dados.json", encoding="utf-8") as f:
    dados = f.read()

# Depois do 2º turno: resultado por UF, municípios que viraram, governadores eleitos e premissas × real entram no painel.
import json as _j, os as _o
if _o.path.exists("dados/tratados/balanco_2t_dados.json"):
    import pandas as _pd, urllib.request as _ur
    _b = _j.load(open("dados/tratados/balanco_2t_dados.json", encoding="utf-8"))
    _meta = _j.load(open("dados/tratados/coleta_2t_meta.json", encoding="utf-8")) if _o.path.exists("dados/tratados/coleta_2t_meta.json") else {}
    _of = None  # totais oficiais do arquivo nacional do TSE (inclui o exterior); se falhar, usa a soma dos municípios
    try:
        _n = _j.load(_ur.urlopen("https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json", timeout=15))
        _v = {c["n"]: int(c["vap"]) for a in _n["carg"][0]["agr"] for pp in a["par"] for c in pp["cand"]}
        _num = lambda x: float(str(x).replace(",", "."))
        _of = {"lula": _v["13"], "flavio": _v["22"], "brancos": int(_n["v"]["vb"]), "nulos": int(_n["v"]["tvn"]), "abstencao": int(_n["e"]["a"]),
               "comparecimento": int(_n["e"]["c"]), "eleitorado": int(_n["e"]["te"]), "pst": _num(_n["s"]["pstn"]), "final": _n.get("tf") == "s", "dh": f"{_n['dg']} {_n['hg']}"}
    except Exception as _e:
        print("aviso: arquivo nacional do TSE indisponível, usando a soma dos municípios:", _e)
    _m2 = _pd.read_csv("dados/tratados/balanco_2t_municipio.csv", sep=";", dtype={"cd_tse": str})
    _vir = _m2[_m2.virou].sort_values("eleitorado", ascending=False).head(40)
    _viraram = [[r.uf, r.municipio, int(r.eleitorado), r.vencedor_1t, r.vencedor_2t, float(r.pct_lula_1t), float(r.pct_lula_2t)] for r in _vir.itertuples()]
    _govs = []
    if _o.path.exists("dados/tratados/governador_2t_2026_municipio.csv"):
        _g = _pd.read_csv("dados/tratados/governador_2t_2026_municipio.csv", sep=";", dtype={"cd_tse": str})
        _cands = [c for c in _g.columns if "(" in c]
        for _uf, _gg in _g.groupby("uf"):
            _tot = {c: int(_gg[c].sum()) for c in _cands if _gg[c].sum() > 0}
            _ord = sorted(_tot.items(), key=lambda kv: -kv[1])
            _va = sum(_tot.values())
            _govs.append({"uf": _uf, "candidatos": [{"nome": k, "votos": v, "pct": round(100 * v / _va, 2) if _va else 0} for k, v in _ord],
                          "eleitorado": int(_gg.eleitorado.sum()), "abstencao": int(_gg.abstencao.sum()), "brancos_nulos": int(_gg.brancos.sum() + _gg.nulos.sum()),
                          "pct_secoes": round(float((_gg.pct_secoes_apuradas * _gg.eleitorado).sum() / max(1, _gg.eleitorado.sum())), 2)})
    _dd = _j.loads(dados)
    _dd["segundo_turno"] = {"brasil": _b["brasil"], "oficial": _of, "premissa_vs_real": _b["premissa_vs_real"], "ufs": _b["ufs"], "territorios": _b["territorios"],
                            "viraram": _viraram, "governadores": _govs, "pct_secoes": _meta.get("pct_secoes"), "final": bool(_meta.get("totalizacao_final")), "gerado_em": _meta.get("gerado_em")}
    dados = _j.dumps(_dd, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print("painel: 2º turno incluído", {"viraram": len(_viraram), "governadores": len(_govs), "oficial": bool(_of)})
with open("painel/painel_template.html", encoding="utf-8") as f:
    corpo = (f.read().replace("__DADOS__", dados.replace("</", "<\\/"))
             .replace("__BASE_CSS__", CSS).replace("__FONTS__", FONTS).replace("__TILES_JS__", TILES_JS))

# o template começa com <title>, <link> e <style>: vão para o <head>
i = corpo.index("</style>") + len("</style>")
head, body = corpo[:i], corpo[i:]

html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{head}
<style>img {{ max-width: 100%; }}</style>
</head>
<body>
{body}
</body>
</html>
"""
for destino in ["painel/painel_2turno.html", "deploy/private/painel.html"]:
    with open(destino, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{destino} gerado")
escrever_globals()

# resumo público para a página de entrada (números nacionais e margem por UF; não exige login)
import json as _json

_d = _json.loads(dados)
_gov = {g["uf"] for g in _d["governadores"]}
_res = {
    "atualizado": _d["atualizado"],
    "brasil": {k: _d["brasil"][k] for k in ["eleitorado", "abstencao", "validos", "flavio", "lula", "eliminados", "brancos", "nulos"]},
    "ufs": [{"uf": u["uf"], "m": round(100 * (u["lula"] - u["flavio"]) / u["validos"], 1), "gov": u["uf"] in _gov} for u in _d["ufs"] if u["uf"] != "ZZ"],
    "municipios": sum(1 for m in _d["municipios"] if m[0] != "ZZ"),
}
with open("deploy/app/sign-in/resumo.json", "w", encoding="utf-8") as f:
    _json.dump(_res, f, ensure_ascii=False, separators=(",", ":"))
print("deploy/app/sign-in/resumo.json gerado")

# resumo para o Raio-X Eleitoral (lib/analista.ts monta a apresentação a partir daqui; nada de número fixo no código)
import os as _os
_b = _d["brasil"]
_resumo = {
    "atualizado": _d["atualizado"],
    "data_1t": "04/10/2026", "data_2t": "25/10/2026",
    "pct_lula": round(100 * _b["lula"] / _b["validos"], 2), "pct_flavio": round(100 * _b["flavio"] / _b["validos"], 2),
    "votos_lula": _b["lula"], "votos_flavio": _b["flavio"], "deficit_lula": _b["flavio"] - _b["lula"],
    "municipios": _res["municipios"],
    "locais": (sum(1 for _ in open("dados/tratados/locais_votacao_2026.csv", encoding="utf-8-sig")) - 1) if _os.path.exists("dados/tratados/locais_votacao_2026.csv") else None,
}
if _os.path.exists("dados/tratados/balanco_2t_dados.json"):  # depois do 2º turno: resultado final no resumo
    with open("dados/tratados/balanco_2t_dados.json", encoding="utf-8") as f:
        _b2 = _json.load(f)["brasil"]
    _tot2 = _b2["lula_2t"] + _b2["flavio_2t"]
    if _tot2 > 0:
        _resumo["segundo_turno"] = {"votos_lula": _b2["lula_2t"], "votos_flavio": _b2["flavio_2t"],
                                    "pct_lula": round(100 * _b2["lula_2t"] / _tot2, 2), "pct_flavio": round(100 * _b2["flavio_2t"] / _tot2, 2),
                                    "vencedor": "Lula" if _b2["lula_2t"] > _b2["flavio_2t"] else "Flávio Bolsonaro" if _b2["flavio_2t"] > _b2["lula_2t"] else "empate"}
        try:  # coleta parcial (madrugada) ou final: o Raio-X diz qual
            with open("dados/tratados/coleta_2t_meta.json", encoding="utf-8") as f:
                _m2 = _json.load(f)
            _resumo["segundo_turno"].update({"pct_secoes": _m2.get("pct_secoes"), "final": bool(_m2.get("totalizacao_final")), "gerado_em": _m2.get("gerado_em")})
        except FileNotFoundError:
            pass
with open("deploy/app/analista/resumo.json", "w", encoding="utf-8") as f:
    _json.dump(_resumo, f, ensure_ascii=False, separators=(",", ":"))
print("deploy/app/analista/resumo.json gerado")
