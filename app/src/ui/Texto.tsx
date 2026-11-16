import { StyleSheet, Text, type TextProps } from 'react-native';
import { cores, tamanhos, tipo } from '../theme/tokens';

export type VarianteTexto = keyof typeof tipo;

export type TextoProps = TextProps & { variante?: VarianteTexto };

// Variantes que são cabeçalho para o leitor de tela.
const CABECALHOS: VarianteTexto[] = ['exibicao', 'titulo', 'secao'];

// Texto sempre >= 16 e com allowFontScaling ligado (a fonte do sistema manda).
// `teto` da escala de tipo vira maxFontSizeMultiplier: só títulos são limitados; texto de leitura escala livre.
export function Texto({ variante = 'corpo', style, accessibilityRole, maxFontSizeMultiplier, ...resto }: TextoProps) {
  const externo = StyleSheet.flatten(style) ?? {};
  const { teto, ...estiloVariante } = tipo[variante];
  const tamanho = Math.max(externo.fontSize ?? estiloVariante.fontSize, tamanhos.fonteMin);
  return (
    <Text
      {...resto}
      accessibilityRole={accessibilityRole ?? (CABECALHOS.includes(variante) ? 'header' : undefined)}
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? teto ?? undefined}
      style={[estilos.base, estiloVariante, externo, { fontSize: tamanho }]}
    />
  );
}

const estilos = StyleSheet.create({
  base: { color: cores.tinta },
});
