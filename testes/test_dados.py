"""Testes de regressão sobre os dados tratados. Rodar: python3 -m pytest testes -q"""
import json
import pandas as pd
import pytest

T = "dados/tratados"
FL, LU = "FLAVIO BOLSONARO (PL)", "LULA (PT)"


@pytest.fixture(scope="module")
def pres():
    return pd.read_csv(f"{T}/presidente_1t_2026_municipio.csv", sep=";", dtype={"cd_tse": str})


def test_totais_nacionais(pres):
    assert pres.validos.sum() == 119_300_788
    assert pres.eleitorado.sum() == 158_745_502
    cand = [c for c in pres.columns if "(" in c]
    assert (pres[cand].sum(axis=1) == pres.validos).all()
    assert (pres.comparecimento == pres.validos + pres.brancos + pres.nulos).all()


def test_municipios(pres):
    assert (pres.cd_tse.str.len() == 5).all() and pres.cd_tse.is_unique
    assert (pres.uf != "ZZ").sum() == 5571


def test_estrategia_coerente():
    e = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", dtype={"cd_tse": str})
    d = json.load(open(f"{T}/estrategia_dados.json", encoding="utf-8"))
    assert d["virada"]["deficit"] == int((e[FL] - e[LU]).sum())
    assert abs(d["virada"]["cenarios"]["base"]["saldo_liquido"] - e.saldo_liquido.sum()) < 10
    assert (e.ganho_total >= 0).all() and e.ganho_total.notna().all()


def test_locais_batem_com_municipios():
    l = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";")
    e = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";")
    assert abs(l.ganho_persuadir.sum() / e.ganho_persuadir.sum() - 1) < 0.05
    assert l.pct_abstencao.notna().all() and (l.aptos >= l.comparecimento).all()


def test_base_apuracao_igual_coleta(pres):
    base = json.load(open("deploy/private/base_apuracao.json"))
    assert len(base) == len(pres)
    assert sum(b["lula"] for b in base.values()) == pres[LU].sum()


# ---- acrescentados em 20/10: pegam os erros encontrados na revisão (todos baratos: só leem CSV/JSON já gerados)
import os

def _json_estrito(caminho):
    def recusa(c):
        raise ValueError(f"{caminho} tem {c} (NaN/Infinity não existem em JSON e quebram o navegador)")
    return json.load(open(caminho, encoding="utf-8"), parse_constant=recusa)


def test_locais_somam_como_municipios():
    """Locais de votação sem cadastro entram no outer join: a soma por local bate com a soma por município (±0,1%)."""
    l = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";", usecols=["lula", "flavio", "aptos", "comparecimento"])
    e = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", usecols=["uf", LU, FL])
    e = e[e.uf != "ZZ"]
    assert abs(l.lula.sum() / e[LU].sum() - 1) < 0.001
    assert abs(l.flavio.sum() / e[FL].sum() - 1) < 0.001


def test_secoes_e_candidatos():
    s = pd.read_csv(f"{T}/secoes_2026.csv", sep=";", usecols=["uf", "lula", "flavio", "comparecimento"])
    e = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", usecols=["uf", LU, FL])
    e = e[e.uf != "ZZ"]
    assert s.lula.sum() == e[LU].sum() and s.flavio.sum() == e[FL].sum()
    assert s.comparecimento.sum() > 0
    cand = pd.read_csv(f"{T}/candidatos_2026.csv", sep=";", dtype=str)
    assert {"13", "22"} <= set(cand.numero) and len(cand) >= 4


def test_jsons_sem_nan():
    for nome in ["painel_dados.json", "estrategia_dados.json", "balanco_2t_dados.json"]:
        if os.path.exists(f"{T}/{nome}"):
            _json_estrito(f"{T}/{nome}")
    for uf in os.listdir("deploy/private/locais"):
        _json_estrito(f"deploy/private/locais/{uf}")


def test_resumo_do_agente(pres):
    r = _json_estrito("deploy/app/analista/resumo.json")
    assert r["deficit_lula"] == int(pres[FL].sum() - pres[LU].sum())
    assert r["municipios"] == 5571 and r["locais"] and r["locais"] > 90_000
    assert abs(r["pct_flavio"] - 100 * pres[FL].sum() / pres.validos.sum()) < 0.01


def test_governadores_conforme_tse():
    d = _json_estrito(f"{T}/painel_dados.json")
    meta = _json_estrito(f"{T}/coleta_1t_meta.json")
    if "ufs_gov_2t" in meta:
        assert {g["uf"] for g in d["governadores"]} == set(meta["ufs_gov_2t"])


def test_segundo_turno_se_existir():
    arq = f"{T}/presidente_2t_2026_municipio.csv"
    if not os.path.exists(arq):
        pytest.skip("2º turno ainda não coletado")
    t2 = pd.read_csv(arq, sep=";", dtype={"cd_tse": str})
    t1 = pd.read_csv(f"{T}/presidente_1t_2026_municipio.csv", sep=";", dtype={"cd_tse": str})
    meta = _json_estrito(f"{T}/coleta_2t_meta.json")
    assert len(t2) == len(t1)
    assert len([c for c in t2.columns if "(" in c]) == 2
    if meta["pct_secoes"] == 0:
        pytest.skip("2º turno ainda sem seções apuradas (ensaio)")
    assert t2.validos.sum() > 0
    if meta["totalizacao_final"]:  # coleta da madrugada (--parcial, ~99%) não precisa ter todos os municípios
        assert (t2.validos > 0).mean() > 0.99, "2º turno final com municípios zerados"


def test_urna_dados():
    """Dados estáticos da página Sua urna: exemplo de referência (Aracaju, zona 1, seção 3) e totais coerentes com a base de seções."""
    base = "deploy/public/urna/data"
    if not os.path.exists(f"{base}/stats.json"):
        pytest.skip("gerar_urna.py ainda não rodou")
    stats = _json_estrito(f"{base}/stats.json")
    m = _json_estrito(f"{base}/mun/SE/31054.json")
    linha = next(l for l in m["zonas"]["1"] if l[0] == 3)
    assert linha[2:8] == [382, 170, 98, 24, 19, 71], linha
    assert m["locais"][linha[1]][0].startswith("FRANCISCO ROSA SANTOS")
    assert stats["total_urnas"] > 490_000 and 50 <= stats["abstencao_maior_que_diferenca"]["pct"] <= 60
    assert len(stats["percentis_diferenca"]) == 101 and stats["percentis_diferenca"][50] == stats["mediana_diferenca"]
    sec = pd.read_csv(f"{T}/secoes_2026.csv", sep=";", usecols=["tipo_secao", "lula", "flavio"])
    com_voto = sec[sec.tipo_secao != "Agregada"]
    assert stats["total_lula"] == int(com_voto.lula.sum()) and stats["total_flavio"] == int(com_voto.flavio.sum())
