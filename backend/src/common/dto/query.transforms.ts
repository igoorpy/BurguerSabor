import { Transform } from 'class-transformer';

/** Converte "true"/"false" vindos da query string em boolean (outros valores ficam como estão e falham na validação). */
export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value));
