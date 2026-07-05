export const RANGOS = [
  { letra: "F", min: 0 },
  { letra: "E", min: 10 },
  { letra: "D", min: 20 },
  { letra: "C", min: 30 },
  { letra: "B", min: 40 },
  { letra: "A", min: 50 },
  { letra: "S", min: 60 },
  { letra: "SS", min: 70 },
  { letra: "SS+", min: 80 },
  { letra: "EX", min: 100 },
];

export function getRango(valor) {
  let actual = RANGOS[0].letra;
  for (const r of RANGOS) {
    if (valor >= r.min) actual = r.letra;
    else break;
  }
  return actual;
}

const PESOS = {
  fuerza: 5,
  resistencia: 5,
  velocidad: 4,
  inteligencia: 2.5,
  habilidades_combate: 4,
  portal: 5,
  afinidad_espiritual: 4,
  suerte: 1,
  carisma: 0,
};

export function getPuntuacionTotal(stats) {
  return Object.entries(PESOS).reduce((total, [attr, peso]) => {
    return total + (stats[attr] ?? 0) * peso;
  }, 0);
}