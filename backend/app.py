"""
Simple Calculator backend.
- Uses ONLY Python standard library.
- Safely evaluates math expressions via AST whitelist (no eval/exec).
- Serves the React build (frontend/dist) as static files.
"""
from __future__ import annotations

import ast
import json
import operator
import os
import socket
import sys
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse


# ---------- Safe expression evaluator ----------

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


class CalcError(Exception):
    pass


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise CalcError("only numeric literals are allowed")
    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _BIN_OPS:
            raise CalcError(f"operator not allowed: {op_type.__name__}")
        return _BIN_OPS[op_type](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _UNARY_OPS:
            raise CalcError(f"unary operator not allowed: {op_type.__name__}")
        return _UNARY_OPS[op_type](_eval(node.operand))
    raise CalcError(f"unsupported syntax: {type(node).__name__}")


def safe_calc(expression: str) -> float:
    if not isinstance(expression, str):
        raise CalcError("expression must be a string")
    if len(expression) > 200:
        raise CalcError("expression too long")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        raise CalcError(f"syntax error: {e.msg}") from None
    try:
        result = _eval(tree)
    except ZeroDivisionError:
        raise CalcError("division by zero")
    except OverflowError:
        raise CalcError("number too large")
    if isinstance(result, float) and (result != result or result in (float("inf"), float("-inf"))):
        raise CalcError("invalid result")
    return result


# ---------- Static + JSON HTTP handler ----------

def resource_path(*parts: str) -> str:
    """Return path to bundled resource (works in dev and PyInstaller --onefile)."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


STATIC_ROOT = resource_path("static")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_ROOT, **kwargs)

    def log_message(self, format, *args):
        # Quiet console
        return

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/calc":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 4096:
            self._json(413, {"error": "payload too large"})
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            expr = data.get("expression", "")
            value = safe_calc(expr)
            self._json(200, {"result": value})
        except CalcError as e:
            self._json(400, {"error": str(e)})
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid json"})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json(200, {"status": "ok"})
            return
        # SPA fallback: unknown routes -> index.html
        full = os.path.join(STATIC_ROOT, path.lstrip("/"))
        if path != "/" and not os.path.exists(full):
            self.path = "/index.html"
        return super().do_GET()


# ---------- Server ----------

def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    port = _free_port()
    server = HTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"Calculator running at {url}  (Ctrl+C to quit)")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
