import { useState, useCallback, useEffect } from 'react';
import { safeCalc, CalcError } from './safeCalc';

type HistoryItem = { expr: string; result: string };

const KEYS: string[][] = [
  ['C', '(', ')', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];

export default function App() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);

  const calc = useCallback(async (e: string) => {
    if (!e.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: e }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '오류');
        setResult('');
      } else {
        const r = String(data.result);
        setResult(r);
        setHistory((h) => [{ expr: e, result: r }, ...h].slice(0, 20));
      }
    } catch (err) {
      // 백엔드 미사용(GitHub Pages 등) → 클라이언트 사이드 안전 평가기로 폴백
      try {
        const r = String(safeCalc(e));
        setResult(r);
        setHistory((h) => [{ expr: e, result: r }, ...h].slice(0, 20));
      } catch (e2) {
        setError(e2 instanceof CalcError ? e2.message : '계산 오류');
        setResult('');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const press = useCallback(
    (k: string) => {
      if (k === 'C') {
        setExpr('');
        setResult('');
        setError('');
        return;
      }
      if (k === '⌫') {
        setExpr((e) => e.slice(0, -1));
        return;
      }
      if (k === '=') {
        calc(expr);
        return;
      }
      setExpr((e) => e + k);
    },
    [expr, calc]
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key;
      if (/^[0-9.+\-*/()]$/.test(k)) {
        ev.preventDefault();
        setExpr((e) => e + k);
      } else if (k === 'Enter' || k === '=') {
        ev.preventDefault();
        calc(expr);
      } else if (k === 'Backspace') {
        ev.preventDefault();
        setExpr((e) => e.slice(0, -1));
      } else if (k === 'Escape') {
        ev.preventDefault();
        setExpr('');
        setResult('');
        setError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expr, calc]);

  return (
    <div className="app">
      <div className="calc">
        <h1>계산기</h1>
        <div className="display">
          <div className="expr">{expr || '\u00A0'}</div>
          <div className={`result ${error ? 'err' : ''}`}>
            {error ? error : result || '\u00A0'}
          </div>
        </div>
        <div className="pad">
          {KEYS.flat().map((k) => (
            <button
              key={k}
              className={`btn ${
                k === '=' ? 'eq' : /[0-9.]/.test(k) ? 'num' : 'op'
              }`}
              onClick={() => press(k)}
              disabled={busy}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="history">
        <h2>기록</h2>
        {history.length === 0 ? (
          <p className="empty">아직 계산 기록이 없습니다</p>
        ) : (
          <ul>
            {history.map((h, i) => (
              <li key={i} onClick={() => setExpr(h.expr)}>
                <span className="h-expr">{h.expr}</span>
                <span className="h-eq">=</span>
                <span className="h-res">{h.result}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
