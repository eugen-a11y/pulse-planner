import { snakifyKeys, snakeToCamelRow } from "@pulse/core";

const BOOL_FIELDS_BY_TABLE: Record<string, readonly string[]> = {
  projects: ["archived"],
};

/** Convert a domain object (camelCase, JS booleans) to a SQLite row (snake_case, 0/1 ints). */
export function toSqliteRow(table: string, obj: Record<string, unknown>): Record<string, unknown> {
  const snake = snakifyKeys(obj);
  const boolFields = BOOL_FIELDS_BY_TABLE[table] ?? [];
  for (const camelField of boolFields) {
    const snakeField = camelField.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
    if (snakeField in snake) {
      snake[snakeField] = snake[snakeField] ? 1 : 0;
    }
  }
  return snake;
}

/** Convert a SQLite row (snake_case, 0/1 ints) to a domain object (camelCase, JS booleans). */
export function fromSqliteRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const camel = snakeToCamelRow(row);
  const boolFields = BOOL_FIELDS_BY_TABLE[table] ?? [];
  for (const f of boolFields) {
    if (f in camel) {
      camel[f] = camel[f] === 1 || camel[f] === true;
    }
  }
  return camel;
}
