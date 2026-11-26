type Token = { type: "number" | "operator" | "left" | "right"; value: string };

function tokenize(expression: string): Token[] {
  if (expression.length < 1 || expression.length > 100) throw new Error("Use an expression under 100 characters.");
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch ?? "")) { i += 1; continue; }
    if (/[0-9.]/.test(ch ?? "")) {
      const match = expression.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error("That number is not valid.");
      tokens.push({ type: "number", value: match[0] });
      i += match[0].length;
      continue;
    }
    if (ch === "(") { tokens.push({ type: "left", value: ch }); i += 1; continue; }
    if (ch === ")") { tokens.push({ type: "right", value: ch }); i += 1; continue; }
    const op = expression.slice(i).match(/^(?:\*\*|[+\-*/%^])/);
    if (op) { tokens.push({ type: "operator", value: op[0] }); i += op[0].length; continue; }
    throw new Error("Only numbers, parentheses, and + - * / % ^ are supported.");
  }
  return tokens;
}

export function calculate(expression: string): number {
  const tokens = tokenize(expression);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const bounded = (n: number) => {
    if (!Number.isFinite(n) || Math.abs(n) > 1e100) throw new Error("That result is outside the supported range.");
    return n;
  };

  function primary(): number {
    const token = take();
    if (token?.type === "number") return Number(token.value);
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      return bounded((token.value === "-" ? -1 : 1) * power());
    }
    if (token?.type === "left") {
      const value = sum();
      if (take()?.type !== "right") throw new Error("Check the parentheses in that expression.");
      return value;
    }
    throw new Error("That expression is incomplete.");
  }
  function power(): number {
    const left = primary();
    if (peek()?.type === "operator" && (peek()?.value === "^" || peek()?.value === "**")) {
      take();
      return bounded(left ** power());
    }
    return left;
  }
  function product(): number {
    let value = power();
    while (peek()?.type === "operator" && ["*", "/", "%"].includes(peek()?.value ?? "")) {
      const operator = take()?.value;
      const right = power();
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("Division by zero is not allowed.");
      value = bounded(operator === "*" ? value * right : operator === "/" ? value / right : value % right);
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek()?.type === "operator" && (peek()?.value === "+" || peek()?.value === "-")) {
      const operator = take()?.value;
      const right = product();
      value = bounded(operator === "+" ? value + right : value - right);
    }
    return value;
  }

  const result = sum();
  if (cursor !== tokens.length) throw new Error("There is an unexpected part in that expression.");
  return result;
}