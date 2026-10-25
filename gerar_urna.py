"""Dados estáticos da página "Por quantos votos a sua urna foi decidida?" (deploy/app/urna), a partir de secoes_2026.csv.

Saída em deploy/public/urna/data/ (servida pela CDN, sem banco):
  index.json            estados e municípios
  stats.json            estatísticas nacionais e percentis da diferença (para "mais apertada que X% das urnas")
  mun/<UF>/<CD>.json    zonas, seções e locais de um município, em arrays compactos

Seções "Agregadas" não têm votos próprios (votam na principal): entram com o número da principal, e a página mostra
os números dela com aviso. TURNO=2 gera a partir de secoes_2026_2t.csv (quando o TSE publicar o 2º turno por seção).
"""

import json
import os
import shutil

import numpy as np
import pandas as pd

TURNO = int(os.environ.get("TURNO", "1"))
T = "dados/tratados"
CSV = f"{T}/secoes_2026.csv" if TURNO == 1 else f"{T}/secoes_2026_2t.csv"
OUT = "deploy/public/urna/data"
UFS = {"AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
       "GO": "Goiás", "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso", "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco",
       "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RO": "Rondônia", "RR": "Roraima", "RS": "Rio Grande do Sul",
       "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo", "TO": "Tocantins", "ZZ": "Exterior"}
CAMPOS = ["secao", "local", "aptos", "lula", "flavio", "outros", "branco_nulo", "abstencao", "principal"]


def gravar(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


if __name__ == "__main__":
    if not os.path.exists(CSV):
        raise SystemExit(3)  # mesmo código dos outros scripts: turno ainda não publicado
    s = pd.read_csv(CSV, sep=";", dtype={"cd_tse": str, "cep": str},
                    usecols=["uf", "cd_tse", "municipio", "zona", "secao", "tipo_secao", "secao_principal", "nr_local", "local", "endereco", "bairro",
                             "aptos", "comparecimento", "abstencao", "lula", "flavio", "eliminados", "brancos", "nulos"])
    for c in ["zona", "secao", "nr_local", "aptos", "comparecimento", "abstencao", "lula", "flavio", "eliminados", "brancos", "nulos"]:
        s[c] = s[c].fillna(0).astype(int)
    s["secao_principal"] = s.secao_principal.fillna(0).astype(int)
    s["principal"] = np.where(s.tipo_secao == "Agregada", s.secao_principal, 0)
    s["outros"] = s.eliminados
    s["branco_nulo"] = s.brancos + s.nulos
    com_voto = s[s.tipo_secao != "Agregada"]
    assert len(s) > 400_000 and com_voto.lula.sum() > 0, "secoes_2026.csv incompleto"

    # estatísticas nacionais (só urnas com votos próprios)
    dif = (com_voto.lula - com_voto.flavio).abs()
    n = len(com_voto)
    med = {k: int(round(com_voto[k].mean())) for k in ["aptos", "abstencao", "lula", "flavio", "outros", "branco_nulo"]}
    med["diferenca"] = abs(med["lula"] - med["flavio"])
    stats = {
        "turno": TURNO, "eleicao": f"{TURNO}º turno de 2026", "data": "04/10/2026" if TURNO == 1 else "25/10/2026",
        "total_urnas": int(n), "media": med,
        "empates": int((dif == 0).sum()), "diferenca_ate_5": int((dif <= 5).sum()),
        "abstencao_maior_que_diferenca": {"urnas": int((com_voto.abstencao > dif).sum()), "pct": int(round(100 * (com_voto.abstencao > dif).mean()))},
        "mediana_diferenca": int(dif.median()),
        "total_lula": int(com_voto.lula.sum()), "total_flavio": int(com_voto.flavio.sum()), "total_abstencao": int(com_voto.abstencao.sum()),
        # percentis 0..100 da diferença: a página diz "mais apertada que X% das urnas do Brasil"
        "percentis_diferenca": [int(x) for x in np.percentile(dif, range(0, 101))],
    }
    print(json.dumps({k: v for k, v in stats.items() if k != "percentis_diferenca"}, ensure_ascii=False))

    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    gravar(f"{OUT}/stats.json", stats)

    # índice: UFs (nome por extenso, Exterior por último) e municípios em ordem alfabética
    idx = []
    muns = s[["uf", "cd_tse", "municipio"]].drop_duplicates().sort_values(["uf", "municipio"])
    for uf, g in muns.groupby("uf", sort=False):
        idx.append({"sg": uf, "nome": UFS.get(uf, uf), "municipios": [[r.cd_tse, r.municipio] for r in g.itertuples()]})
    idx.sort(key=lambda u: (u["sg"] == "ZZ", u["nome"]))
    gravar(f"{OUT}/index.json", {"ufs": idx, "turno": TURNO})

    # um arquivo por município
    total = 0
    for (uf, cd), g in s.groupby(["uf", "cd_tse"]):
        g = g.sort_values(["zona", "secao"])
        locais, zonas = {}, {}
        for r in g.itertuples(index=False):
            lid = f"{r.zona}-{r.nr_local}"
            if lid not in locais:
                locais[lid] = [str(r.local) if pd.notna(r.local) else "", str(r.endereco) if pd.notna(r.endereco) else "", str(r.bairro) if pd.notna(r.bairro) else ""]
            zonas.setdefault(str(r.zona), []).append([int(r.secao), lid, int(r.aptos), int(r.lula), int(r.flavio), int(r.outros), int(r.branco_nulo), int(r.abstencao), int(r.principal)])
        gravar(f"{OUT}/mun/{uf}/{cd}.json", {"uf": uf, "cd": cd, "nome": g.municipio.iloc[0], "campos": CAMPOS, "locais": locais, "zonas": zonas})
        total += 1
    print(f"{OUT}: {total} municípios, {len(s)} seções ({len(s) - n} agregadas)")
