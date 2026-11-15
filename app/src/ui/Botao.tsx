import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { cores, espacos, fontes, tamanhos } from '../theme/tokens';
import { Texto } from './Texto';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo';

export type BotaoProps = {
  rotulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  desabilitado?: boolean;
  carregando?: boolean;
  dica?: string;
};

// Pares texto/fundo daqui constam em paresDeTexto (contraste testado).
const aparencia: Record<VarianteBotao, { fundo: string; texto: string; borda: string }> = {
  primario: { fundo: cores.esmeralda, texto: cores.tinta, borda: cores.esmeralda },
  secundario: { fundo: cores.areia, texto: cores.petroleo, borda: cores.petroleo },
  perigo: { fundo: cores.alarme, texto: cores.sobreAlarme, borda: cores.alarme },
};

export function Botao({ rotulo, onPress, variante = 'primario', desabilitado, carregando, dica }: BotaoProps) {
  const inativo = Boolean(desabilitado || carregando);
  const a = aparencia[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: inativo, busy: Boolean(carregando) }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.base,
        { backgroundColor: a.fundo, borderColor: a.borda },
        pressed && estilos.pressionado,
        inativo && estilos.inativo,
      ]}
    >
      <View style={estilos.conteudo}>
        {carregando ? <ActivityIndicator color={a.texto} style={estilos.indicador} /> : null}
        <Texto style={[estilos.rotulo, { color: a.texto }]}>{rotulo}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: tamanhos.alvoMin,
    minWidth: tamanhos.alvoMin,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: espacos.m,
    paddingVertical: espacos.p,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conteudo: { flexDirection: 'row', alignItems: 'center' },
  indicador: { marginRight: espacos.p },
  rotulo: { fontFamily: fontes.semibold, textAlign: 'center' },
  pressionado: { opacity: 0.85 },
  inativo: { opacity: 0.5 },
});
