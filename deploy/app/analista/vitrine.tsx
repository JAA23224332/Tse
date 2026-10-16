import exemplos from "./exemplos.json";
import "./analista.css";

type Exemplo = { pergunta: string; resposta: string; colunas: string[]; linhas: (string | number)[][]; fonte: string };
const fmt = (v: string | number) => typeof v === "number" ? v.toLocaleString("pt-BR") : v;

/** Três perguntas reais já respondidas: mostra o que o Raio-X faz antes de a pessoa pedir acesso. */
export function Vitrine({ onPerguntar }: { onPerguntar?: (q: string) => void }) {
  return (
    <div className="vitrine">
      {(exemplos as Exemplo[]).map((e) => (
        <article key={e.pergunta} className="exemplo">
          <h3>{e.pergunta}</h3>
          <p>{e.resposta}</p>
          <div className="tbl"><table>
            <thead><tr>{e.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{e.linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className={typeof c === "number" || /%$/.test(String(c)) ? "n" : ""}>{fmt(c)}</td>)}</tr>)}</tbody>
          </table></div>
          <span className="fonte">Fonte: {e.fonte}</span>
          {onPerguntar && <button type="button" className="btn" onClick={() => onPerguntar(e.pergunta)}>Fazer esta pergunta</button>}
        </article>
      ))}
    </div>
  );
}
