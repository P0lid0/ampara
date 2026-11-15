import { StyleSheet, Text, type TextProps } from 'react-native';
import { cores, fontes, tamanhos } from '../theme/tokens';

export type VarianteTexto = 'titulo' | 'corpo' | 'legenda';

export type TextoProps = TextProps & { variante?: VarianteTexto };

// Texto sempre >= 16 e com allowFontScaling ligado (a fonte do sistema manda).
export function Texto({ variante = 'corpo', style, accessibilityRole, ...resto }: TextoProps) {
  const externo = StyleSheet.flatten(style) ?? {};
  const tamanho = Math.max(externo.fontSize ?? estilos[variante].fontSize, tamanhos.fonteMin);
  return (
    <Text
      {...resto}
      accessibilityRole={accessibilityRole ?? (variante === 'titulo' ? 'header' : undefined)}
      allowFontScaling
      style={[estilos.base, estilos[variante], externo, { fontSize: tamanho }]}
    />
  );
}

const estilos = StyleSheet.create({
  base: { color: cores.tinta },
  titulo: { fontSize: 24, lineHeight: 32, fontFamily: fontes.bold },
  corpo: { fontSize: 18, lineHeight: 26, fontFamily: fontes.regular },
  legenda: { fontSize: tamanhos.fonteMin, lineHeight: 22, fontFamily: fontes.regular },
});
