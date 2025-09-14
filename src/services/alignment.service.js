// src/services/alignment.service.js
export function computeAlignment({ R90, R180, R270, F90, F180, F270, H, D, E }) {
  if (!Number(H)) throw new Error("H no puede ser 0 o vacío");

  // Vertical (usa lecturas a 180°)
  const VN = (R180 / 2) + (D * (F180 / H));
  const VF = (R180 / 2) + (E * (F180 / H));

  // Horizontal (diferencias 270° - 90°)
  const HN = ((R270 - R90) / 2) + (D * ((F270 - F90) / H));
  const HF = ((R270 - R90) / 2) + (E * ((F270 - F90) / H));

  return { VN, VF, HN, HF };
}
