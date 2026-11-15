// Identidade visual do Ampara (contratos, seção "Identidade").
// As quatro cores da marca (petróleo, esmeralda, areia, alarme) não mudam;
// se um par de texto reprovar no contraste, escurece-se a cor do TEXTO.
export const cores = {
  petroleo: '#0F4C4A',
  esmeralda: '#14B88A',
  areia: '#F4EFE6',
  alarme: '#E5484D',
  tinta: '#12201F',
  sobreAlarme: '#000000',
  branco: '#FFFFFF',
} as const;

export type NomeCor = keyof typeof cores;

// Alvo de toque mínimo (dp) e fonte mínima (pt), critérios de acessibilidade.
export const tamanhos = {
  alvoMin: 48,
  fonteMin: 16,
} as const;

// Famílias carregadas por @expo-google-fonts/manrope no _layout.
export const fontes = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const espacos = {
  p: 8,
  m: 16,
  g: 24,
} as const;
