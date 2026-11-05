import { BusinessRuleError } from '../errors';

/**
 * Nos DTOs de atualização (PartialType), o @IsOptional() deixa passar `null` além de `undefined`.
 * Esta checagem garante que `null` só seja aceito nos campos que podem ser "limpos"
 * (ex.: descrição, ponto de referência). Nos demais, responde 422 como uma falha de validação.
 */
export function garantirSemNulos(dto: object, podemSerNulos: string[] = []): void {
  const invalidos = Object.entries(dto)
    .filter(([campo, valor]) => valor === null && !podemSerNulos.includes(campo))
    .map(([campo]) => `${campo} não pode ser nulo`);
  if (invalidos.length) {
    throw new BusinessRuleError(invalidos.length === 1 ? invalidos[0] : 'Campos não podem ser nulos', invalidos);
  }
}
