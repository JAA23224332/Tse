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
