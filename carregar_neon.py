"""Carrega as bases tratadas no Postgres (Neon) do site, para o analista de IA e as páginas.

Lê DATABASE_URL de deploy/.env.local. Recria as tabelas a cada execução.
Tabelas: municipios, ufs, locais_votacao (se existir o CSV), premissas.
"""

import os
import re
import sys

import pandas as pd
import psycopg

T = "dados/tratados"


def url_banco():
    with open("deploy/.env.local") as f:
        for linha in f:
            if linha.startswith("DATABASE_URL="):
                return linha.split("=", 1)[1].strip().strip('"')
    sys.exit("DATABASE_URL não encontrada em deploy/.env.local")


def nome_sql(c):
    c = c.lower().replace("%", "pct").replace("+", "mais")
    c = re.sub(r"[^a-z0-9]+", "_", c.encode("ascii", "ignore").decode()).strip("_")
    return {"flavio_bolsonaro_pl": "votos_flavio", "lula_pt": "votos_lula"}.get(c, c)


def tipo_sql(s):
    if pd.api.types.is_bool_dtype(s):
        return "boolean"
    if pd.api.types.is_integer_dtype(s):
        return "bigint"
    if pd.api.types.is_float_dtype(s):
        return "double precision"
    return "text"


def carregar(cur, df, tabela, chave=None):
    df = df.copy()
    df.columns = [nome_sql(c) for c in df.columns]
    cols = ", ".join(f'"{c}" {tipo_sql(df[c])}' for c in df.columns)
    cur.execute(f"drop table if exists {tabela}")
    cur.execute(f"create table {tabela} ({cols})")
    with cur.copy(f"copy {tabela} from stdin") as cp:
        for linha in df.itertuples(index=False):
            cp.write_row([None if (isinstance(v, float) and pd.isna(v)) else v for v in linha])
    if chave:
        cur.execute(f"create index on {tabela} ({chave})")
    # a tabela foi recriada: devolve a permissão de leitura ao usuário do agente (raiox_leitor)
    cur.execute(f"grant select on {tabela} to raiox_leitor")
    cur.connection.commit()  # uma transação por tabela: o espaço da tabela antiga é liberado antes da próxima
    print(f"{tabela}: {len(df)} linhas, {len(df.columns)} colunas")


if __name__ == "__main__":
    mun = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", dtype={"cd_tse": str, "cd_ibge": str})
    uf = pd.read_csv(f"{T}/estrategia_uf.csv", sep=";")
    with psycopg.connect(url_banco()) as conn, conn.cursor() as cur:
        carregar(cur, mun, "municipios", "uf")
        carregar(cur, uf, "ufs")
        if os.path.exists(f"{T}/locais_votacao_2026.csv"):
            loc = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";", dtype={"cd_tse": str})
            carregar(cur, loc, "locais_votacao", "uf, cd_tse")
        # seções (269 MB no banco): só recarrega se o CSV for mais novo que a última carga ou com RECARREGAR_SECOES=1
        marca = f"{T}/.secoes_carregadas"
        csv_sec = f"{T}/secoes_2026.csv"
        if os.path.exists(csv_sec) and (os.environ.get("RECARREGAR_SECOES") == "1" or not os.path.exists(marca)
                                        or os.path.getmtime(csv_sec) > os.path.getmtime(marca)):
            cur.execute("drop table if exists secoes"); cur.connection.commit()  # libera espaço antes de copiar
            sec = pd.read_csv(csv_sec, sep=";", dtype={"cd_tse": str, "cep": str})
            carregar(cur, sec, "secoes", "uf, cd_tse, zona, secao")
            cur.execute("create index on secoes (uf, zona, secao)")
            carregar(cur, pd.read_csv(f"{T}/candidatos_2026.csv", sep=";", dtype=str), "candidatos")
            open(marca, "w").close()
        else:
            print("secoes: sem mudança, não recarregada")
        cur.execute("""
            comment on table municipios is 'Resultado do 1º turno de 2026 para presidente por município, com 2022, perfil do eleitorado e potencial de ganho para Lula';
            comment on table ufs is 'Agregado por UF do 1º turno de 2026 e potencial de ganho para Lula';
        """)
        conn.commit()
