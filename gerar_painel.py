"""Monta painel/painel_2turno.html (arquivo HTML independente, abre direto no navegador)
a partir do template, da identidade visual compartilhada e de dados/tratados/painel_dados.json."""

from identidade import CSS, FONTS, TILES_JS, escrever_globals

with open("dados/tratados/painel_dados.json", encoding="utf-8") as f:
    dados = f.read()
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
with open("deploy/app/analista/resumo.json", "w", encoding="utf-8") as f:
    _json.dump(_resumo, f, ensure_ascii=False, separators=(",", ":"))
print("deploy/app/analista/resumo.json gerado")
