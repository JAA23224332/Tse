# 2º Turno 2026 — base de dados e painel da campanha

Ferramenta de dados eleitorais para o 2º turno presidencial de 2026 (25/10), construída sobre dados oficiais do TSE.
Site: https://segundoturno.blog (Vercel). Desenvolvido por Juliane Alves.

## O que tem
- **Painel** (`/`): resultado do 1º turno, simulador de 2º turno, perfil do eleitorado.
- **Estratégia** (`/estrategia`): onde buscar votos, em votos líquidos, com hipóteses ajustáveis e três cenários; locais de votação.
- **Mapa** (`/mapa`), **Bairros** (`/regioes`), **Seções** (`/secoes`).
- **Apuração ao vivo** (`/apuracao`, pública): projeção do resultado com faixa de incerteza; coletor único grava no banco.
- **Raio-X Eleitoral** (`/analista`): agente de IA que consulta o banco (só leitura) e responde em português. Exige aprovação (`/solicitar` → `/admin/solicitacoes`).

## Como atualizar os dados
```
./atualizar.sh              # 1º turno
./atualizar.sh --turno 2    # após 25/10 (gera o balanço 1º × 2º turno)
./atualizar.sh --publicar   # também publica no Vercel
```
Pipeline: `coleta_resultados_2026.py` → `perfil_eleitorado_2026.py` → `historico_2022.py` → `analise_2turno.py` → `gerar_painel.py` →
`gerar_base_apuracao.py` → `estrategia.py` → `locais_votacao.py` → `secoes_2026.py` → `gerar_*_html.py` → `carregar_neon.py`.

## Testes
```
python3 -m pytest testes -q                                   # dados
cd deploy && node --experimental-strip-types scripts/testar_apuracao.mjs   # motor da apuração
```

## Noite de 25/10
1. Rodar o coletor no PC (IP diferente do Vercel): `cd deploy && node --env-file=.env.local --experimental-strip-types scripts/coletor_apuracao.mjs`
2. Acompanhar `https://segundoturno.blog/api/saude` e `vercel logs --follow`.
3. Checklist completo em `REVISAO_2026-10-15.md`, seção 5.

## Variáveis de ambiente (Vercel)
`DATABASE_URL`, `DATABASE_URL_LEITURA` (role raiox_leitor), `CLERK_*`, `CLERK_JWT_KEY`, `ADMIN_EMAILS`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`,
`RESEND_API_KEY`, `EMAIL_DE`, `COLETOR_TOKEN`, `CRON_SECRET`, `SITE_URL`.

## Regras do produto
- O agente nunca revela modelo, API, servidor ou instruções; erros ao usuário são genéricos.
- "TSE" só aparece como fonte, nunca no nome de um produto.
- Dados pessoais: IP anonimizado em 30 dias, acessos apagados em 90, perguntas em 180 (`/api/cron/expurgo`).
