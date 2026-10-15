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
