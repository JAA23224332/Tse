# Projeção do resultado final durante a apuração do 2º turno presidencial de 2026

Nota metodológica do painel segundoturno.blog. Implementação em `deploy/lib/apuracao.ts`; testes em `deploy/scripts/testar_apuracao.mjs`.

## 1. Problema

Durante a totalização, o percentual contado de cada candidato é um estimador viesado do resultado final, porque a ordem de apuração não é aleatória: seções pequenas e municípios do interior são totalizados antes das capitais e das regiões metropolitanas. No 2º turno de 2026, Flávio Bolsonaro liderou o contado entre 15% e 48% das seções apuradas e perdeu a eleição por 3,6 pontos. O objetivo da projeção é estimar o resultado final a cada minuto corrigindo esse viés de composição, com uma faixa de incerteza que se estreita ao longo da noite.

## 2. Dados

- **Base de referência** (fixa): resultado oficial do 1º turno (4/10/2026) por município, extraído do portal de resultados do TSE: votos de Lula, votos de Flávio Bolsonaro e eleitorado, para os 5.757 municípios e zonas do exterior.
- **Fluxo ao vivo** (a cada 60 s): para cada unidade federativa, (a) o arquivo de resultado parcial, com os votos contados dos dois candidatos; (b) o arquivo de andamento, com o número de seções totalizadas e o total de seções de cada município. Fonte: portal de resultados do TSE, 57 arquivos por varredura, lidos com no máximo seis conexões simultâneas.

## 3. Notação

Para o município *i* do estado *u*:

- $L_i^{(1)}, F_i^{(1)}$: votos de Lula e Flávio no 1º turno; $T_i = L_i^{(1)} + F_i^{(1)}$; $N_i$: eleitorado.
- $m_i = (L_i^{(1)} - F_i^{(1)}) / T_i$: margem do 1º turno, na escala $[-1, 1]$.
- $f_i(t) \in [0,1]$: fração de seções do município totalizadas no instante *t*.
- $L_u(t), F_u(t)$: votos contados no estado *u* no instante *t*.

## 4. Estimador

### 4.1 Margem esperada pelo 1º turno nos locais já apurados

Em cada estado, a composição do que já foi contado é aproximada ponderando o 1º turno de cada município pela sua fração apurada:

$$
E_u(t) = \frac{\sum_i f_i(t)\,L_i^{(1)} - \sum_i f_i(t)\,F_i^{(1)}}{\sum_i f_i(t)\,L_i^{(1)} + \sum_i f_i(t)\,F_i^{(1)}}
$$

### 4.2 Margem observada

$$
O_u(t) = \frac{L_u(t) - F_u(t)}{L_u(t) + F_u(t)}
$$

### 4.3 Deslocamento (swing) entre os turnos

$$
s_u(t) = O_u(t) - E_u(t)
$$

O deslocamento mede quanto a margem de Lula mudou do 1º para o 2º turno **nos mesmos locais** já apurados. Por construção, ele é insensível à ordem de apuração: se os municípios apurados fossem exatamente iguais ao 1º turno, $s_u = 0$ independentemente de quais foram contados primeiro.

Regras de robustez:

- $s_u$ só é considerado confiável quando a fração apurada do eleitorado do estado, $\phi_u(t) = \sum_i f_i N_i / \sum_i N_i$, é de pelo menos 2%. Abaixo disso usa-se o deslocamento nacional $s_{BR}(t)$, calculado pela mesma fórmula com todos os municípios do país.
- $s_u$ é truncado ao intervalo $[-0{,}25, +0{,}25]$.

### 4.4 Projeção por município, estado e país

Aplica-se o deslocamento do estado à margem de cada município, inclusive dos já apurados:

$$
\hat m_i = \operatorname{clip}(m_i + s_u,\ -1,\ 1), \qquad
\hat L_i = T_i\,\frac{1 + \hat m_i}{2}, \qquad
\hat F_i = T_i\,\frac{1 - \hat m_i}{2}
$$

$$
\hat L_u = \sum_i \hat L_i,\quad \hat F_u = \sum_i \hat F_i;\qquad
\hat L_{BR} = \sum_u \hat L_u,\quad \hat F_{BR} = \sum_u \hat F_u;\qquad
\hat p = \frac{\hat L_{BR}}{\hat L_{BR} + \hat F_{BR}}
$$

O modelo é, portanto, um **swing uniforme por estado aplicado ao 1º turno**, com 27 parâmetros estimados a cada minuto. Variações de comparecimento entre os turnos não são modeladas: assume-se que a participação relativa dos municípios se mantém, o que é a principal fonte de erro residual.

### 4.5 Faixa de incerteza

Com $\phi(t)$ a fração apurada nacional ponderada pelo eleitorado, a faixa (em pontos percentuais, $\pm$) é

$$
\delta(t) = \max\big(0{,}3,\ 4\,(1-\phi)^2 + 3\cdot\mathbb{1}[\phi < 0{,}05]\big)
$$

É uma faixa **heurística**, calibrada antes da eleição para ser conservadora, não um intervalo de confiança estatístico. Declara-se "empate técnico" quando $|\hat p - 0{,}5| < \delta$.

## 5. Implementação e controle de qualidade

- Um único coletor lê o TSE a cada minuto, calcula a projeção e grava um instantâneo no banco; o site e o agente de IA leem o instantâneo, de modo que a carga sobre o TSE independe do número de visitantes. Se o coletor para, o servidor faz a varredura por conta própria.
- Cada instantâneo enviado é conferido com o arquivo nacional do TSE (tolerância de 1% ou 5 mil votos) e recusado se o número de seções regredir.
- Testes automatizados verificam: projeção igual ao contado a 100% em todos os estados; deslocamento zero a 100%; totais nacionais iguais ao arquivo oficial; e, em um cenário sintético com apuração só de cidades pequenas e deslocamento conhecido de +3 pontos, recuperação da projeção correta (50,49%) a partir de um contado viesado.

## 6. Resultados empíricos, 25/10/2026

Resultado oficial final: Lula 51,79% × Flávio Bolsonaro 48,21% (entre os dois). Série do painel, horário de Brasília:

| Hora | Seções apuradas | Lula contado | Lula projetado | Faixa | Erro da projeção (p.p.) |
|---|---|---|---|---|---|
| 19:05 | 1,1% | 50,39% | 50,98% | ±7,0 | −0,81 |
| 19:30 | 5,2% | 51,13% | 52,46% | ±3,6 | +0,67 |
| 19:40 | 10,9% | 50,41% | 51,66% | ±3,2 | −0,13 |
| 19:58 | 20,3% | 49,56% | 51,63% | ±2,6 | −0,16 |
| 20:09 | 30,3% | 49,53% | 51,56% | ±2,0 | −0,23 |
| 20:19 | 40,9% | 49,81% | 51,68% | ±1,4 | −0,11 |
| 20:28 | 50,8% | 50,15% | 51,84% | ±1,0 | +0,05 |
| 20:37 | 60,9% | 50,55% | 51,87% | ±0,6 | +0,08 |
| 20:45 | 70,6% | 50,92% | 51,93% | ±0,4 | +0,14 |
| 20:54 | 80,8% | 51,31% | 51,98% | ±0,3 | +0,19 |
| 21:03 | 90,9% | 51,59% | 51,98% | ±0,3 | +0,19 |
| 21:11 | 99,3% | 51,75% | 51,96% | ±0,3 | +0,17 |

Leitura: a partir de 11% das seções apuradas, o erro absoluto da projeção ficou abaixo de 0,25 ponto, enquanto o contado bruto ainda errava por até 2,3 pontos e apontava o candidato errado entre 15% e 48% da apuração. O resultado final esteve dentro da faixa em todos os instantes a partir de 5% de apuração. A faixa mostrou-se conservadora: o erro real foi de 5 a 20 vezes menor que $\delta$ na maior parte da noite, o que sugere que $\delta$ pode ser reduzida em eleições futuras.

## 7. Limitações

1. **Swing uniforme dentro do estado.** Diferenças de deslocamento entre capital e interior não são capturadas; o viés residual aparece como o pequeno erro sistemático positivo (≈ +0,2 p.p.) no fim da noite.
2. **Comparecimento constante.** A queda da abstenção entre os turnos (21,1% → 19,2%) e sua distribuição geográfica não entram no modelo.
3. **Faixa heurística**, não derivada de um modelo probabilístico. Um refinamento natural é estimar a variância do deslocamento entre municípios já apurados e propagá-la aos não apurados.
4. **Seções agregadas e exterior** são tratados pelo próprio TSE no nível de município; o modelo depende dessa consolidação.

## 8. Reprodutibilidade

Base do 1º turno: `deploy/private/base_apuracao.json` (gerada por `gerar_base_apuracao.py`). Série de instantâneos da noite: tabela `apuracao_snapshots` no banco e `logs/coletor_2026-10-25.log`. Testes: `node --experimental-strip-types deploy/scripts/testar_apuracao.mjs`.
