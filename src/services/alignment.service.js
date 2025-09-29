// src/services/alignment.service.js

const REQUIRED_FIELDS = [
  "R90",
  "R180",
  "R270",
  "F90",
  "F180",
  "F270",
  "H",
  "D",
  "E",
];

/**
 * Calcula los valores de alineación para el método Rim & Face.
 *
 * Se validan las entradas para asegurar que existan y sean números finitos
 * antes de continuar con la operación para evitar resultados inesperados.
 * La lógica original de cálculo se mantiene sin cambios.
 *
 * @param {Record<string, number|string>} rawInput - Lecturas y dimensiones requeridas.
 * @returns {{VN: number, VF: number, HN: number, HF: number}}
 */
export function computeAlignment(rawInput = {}) {
  if (typeof rawInput !== "object" || rawInput === null) {
    throw new TypeError("Los datos de entrada deben ser un objeto");
  }

  const values = REQUIRED_FIELDS.reduce((acc, field) => {
    const numericValue = Number(rawInput[field]);

    if (!Number.isFinite(numericValue)) {
      throw new TypeError(`Entrada inválida: ${field}`);
    }

    acc[field] = numericValue;
    return acc;
  }, {});

  if (values.H === 0) {
    throw new Error("H no puede ser 0");
  }

  const { R90, R180, R270, F90, F180, F270, H, D, E } = values;

  const halfR180 = R180 / 2;
  const rimDiff = (R270 - R90) / 2;
  const faceHalfOnH = F180 / H;
  const faceDiffOnH = (F270 - F90) / H;

  // Vertical (usa lecturas a 180°)
  const VN = halfR180 + D * faceHalfOnH;
  const VF = halfR180 + E * faceHalfOnH;

  // Horizontal (diferencias 270° - 90°)
  const HN = rimDiff + D * faceDiffOnH;
  const HF = rimDiff + E * faceDiffOnH;

  return Object.freeze({ VN, VF, HN, HF });
}
