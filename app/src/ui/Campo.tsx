import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { bordas, cores, espacos, fontes, raios, tamanhos, tipo } from '../theme/tokens';
import { Icone } from './Icone';
import { Texto } from './Texto';

// Instância do TextInput (para refs que encadeiam o teclado).
export type InstanciaCampo = ComponentRef<typeof TextInput>;

export type CampoProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  rotulo: string;
  valor: string;
  onChangeText: (t: string) => void;
  erro?: string;
  // Campo de senha ou código: mostra o botão "Mostrar"/"Ocultar" (só vale com secureTextEntry).
  revelavel?: boolean;
  // Para encadear o teclado (onSubmitEditing do campo anterior chama .focus()).
  entradaRef?: Ref<InstanciaCampo>;
};

// Contorno de 2 px só no campo; 3 px no foco (petróleo) e no erro (alarme).
// Erro nunca só por cor: borda de 3 px + ícone + texto em alarmeTexto sobre alarmeSuave (alarme sobre areia reprova).
export function Campo({ rotulo, valor, onChangeText, erro, revelavel, entradaRef, style, onFocus, onBlur, ...resto }: CampoProps) {
  const [focado, setFocado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const comOlho = Boolean(revelavel && resto.secureTextEntry);
  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo" style={estilos.rotulo}>
        {rotulo}
      </Texto>
      <View>
        <TextInput
          {...resto}
          ref={entradaRef}
          secureTextEntry={resto.secureTextEntry && !(comOlho && visivel)}
          accessibilityLabel={rotulo}
          accessibilityHint={erro ?? resto.accessibilityHint}
          value={valor}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            onBlur?.(e);
          }}
          allowFontScaling
          placeholderTextColor={cores.textoSuave}
          style={[estilos.entrada, comOlho ? estilos.comOlho : null, focado ? estilos.entradaFoco : null, erro ? estilos.entradaErro : null, style]}
        />
        {comOlho ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visivel ? 'Ocultar' : 'Mostrar'} ${rotulo}`}
            onPress={() => setVisivel((v) => !v)}
            style={estilos.olho}
          >
            <Texto variante="rotulo" style={estilos.textoOlho}>
              {visivel ? 'Ocultar' : 'Mostrar'}
            </Texto>
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <View style={estilos.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icone nome="alerta" tamanho={20} cor={cores.alarmeTexto} />
          <Texto variante="legenda" style={estilos.textoAviso}>
            {erro}
          </Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { marginBottom: espacos.m },
  rotulo: { marginBottom: espacos.xs },
  entrada: {
    minHeight: tamanhos.alvoMin,
    borderWidth: bordas.padrao,
    borderColor: cores.petroleo,
    borderRadius: raios.m,
    paddingHorizontal: espacos.pm,
    fontSize: tipo.corpo.fontSize,
    fontFamily: fontes.regular,
    color: cores.tinta,
    backgroundColor: cores.branco,
  },
  comOlho: { paddingRight: 104 },
  olho: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    minWidth: 96,
    minHeight: tamanhos.alvoMin,
    paddingHorizontal: espacos.pm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoOlho: { color: cores.petroleo },
  entradaFoco: { borderWidth: bordas.foco },
  entradaErro: { borderColor: cores.alarme, borderWidth: bordas.foco },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.p,
    marginTop: espacos.p,
    padding: espacos.p,
    borderRadius: raios.p,
    backgroundColor: cores.alarmeSuave,
  },
  textoAviso: { flex: 1, color: cores.alarmeTexto },
});
