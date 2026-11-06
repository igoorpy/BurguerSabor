/**
 * Monta um UPDATE parametrizado a partir de um DTO parcial.
 * Os nomes de coluna vêm SOMENTE do mapa fixo `columns` (nunca do usuário),
 * e os valores vão como parâmetros — sem concatenação de dados no SQL.
 */
export function buildUpdate(
  table: string,
  columns: Record<string, string>,
  changes: Record<string, unknown>,
  id: number,
): { text: string; params: unknown[] } | null {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(columns)) {
    if (changes[field] !== undefined) {
      params.push(changes[field]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return null;

  params.push(id);
  return {
    text: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`,
    params,
  };
}

/** O driver pg devolve DECIMAL como string; convertemos para number na borda do repositório. */
export const toNumber = (value: string | number | null): number => (value === null ? 0 : Number(value));
