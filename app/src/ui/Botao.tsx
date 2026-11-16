import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { bordas, cores, espacos, fontes, raios, tamanhos } from '../theme/tokens';
import { Texto } from './Texto';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'sobreAlarme' | 'texto';

export type BotaoProps = {
  rotulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  desabilitado?: boolean;
  carregando?: boolean;
  dica?: string;
  // Batida leve ao confirmar o toque (expo-haptics). Desligue onde a tela já vibra por conta própria.
  haptica?: boolean;
};

type Aparencia = { fundo: string; texto: string; borda: number; corBorda: string; altura: number; ripple: string };

// Pares texto/fundo daqui constam em paresDeTexto (contraste testado). Hierarquia por preenchimento:
// contorno só no secundário (1 px); primário, perigo e sobreAlarme são cheios.
const aparencia: Record<VarianteBotao, Aparencia> = {
  primario: { fundo: cores.esmeralda, texto: cores.tinta, borda: 0, corBorda: cores.esmeralda, altura: tamanhos.alvoAcao, ripple: cores.petroleo },
  secundario: { fundo: cores.areiaFunda, texto: cores.petroleo, borda: bordas.fina, corBorda: cores.petroleo, altura: tamanhos.alvoMin, ripple: cores.bordaSuave },
  perigo: { fundo: cores.alarme, texto: cores.sobreAlarme, borda: 0, corBorda: cores.alarme, altura: tamanhos.alvoAcao, ripple: cores.sobreAlarme },
  // Sobre o fundo vermelho do alarme: botão areia com texto tinta, 64 dp.
  sobreAlarme: { fundo: cores.areia, texto: cores.tinta, borda: 0, corBorda: cores.areia, altura: tamanhos.alvoAlarme, ripple: cores.bordaSuave },
  texto: { fundo: 'transparent', texto: cores.petroleo, borda: 0, corBorda: 'transparent', altura: tamanhos.alvoMin, ripple: cores.areiaFunda },
};

export function Botao({
  rotulo,
  onPress,
  variante = 'primario',
  desabilitado,
  carregando,
  dica,
  haptica = true,
}: BotaoProps) {
  const inativo = Boolean(desabilitado || carregando);
  const a = aparencia[variante];
  // Desabilitado: sem opacity no rótulo; fundo e texto tonais (textoSuave sobre areiaFunda passa de 4,5:1).
  const apagado = Boolean(desabilitado) && variante !== 'texto';
  const corTexto = apagado ? cores.textoSuave : a.texto;
  const aoTocar = () => {
    if (haptica) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: inativo, busy: Boolean(carregando) }}
      disabled={inativo}
      onPress={aoTocar}
      android_ripple={{ color: a.ripple, foreground: true }}
      style={({ pressed }) => [
        estilos.base,
        {
          minHeight: a.altura,
          backgroundColor: apagado ? cores.areiaFunda : a.fundo,
          borderColor: apagado ? cores.bordaSuave : a.corBorda,
          borderWidth: apagado ? bordas.fina : a.borda,
        },
        variante === 'sobreAlarme' && estilos.largo,
        pressed && estilos.pressionado,
      ]}
    >
      <View style={estilos.conteudo}>
        {carregando ? <ActivityIndicator color={corTexto} style={estilos.indicador} /> : null}
        <Texto
          variante="rotulo"
          style={[
            estilos.rotulo,
            { color: corTexto },
            variante === 'texto' && estilos.sublinhado,
            variante === 'sobreAlarme' && estilos.rotuloAlarme,
          ]}
        >
          {rotulo}
        </Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minWidth: tamanhos.alvoMin,
    borderRadius: raios.m,
    paddingHorizontal: espacos.m,
    paddingVertical: espacos.p,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  largo: { alignSelf: 'stretch' },
  conteudo: { flexDirection: 'row', alignItems: 'center' },
  indicador: { marginRight: espacos.p },
  rotulo: { fontFamily: fontes.semibold, textAlign: 'center' },
  rotuloAlarme: { fontSize: 20, lineHeight: 28 },
  sublinhado: { textDecorationLine: 'underline' },
  // Escala 0,98 instantânea enquanto pressiona (sem biblioteca, sem animação).
  pressionado: { transform: [{ scale: 0.98 }] },
});
