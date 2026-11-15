import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { cores, espacos, fontes, tamanhos } from '../theme/tokens';
import { Texto } from './Texto';

export type CampoProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  rotulo: string;
  valor: string;
  onChangeText: (t: string) => void;
  erro?: string;
};

// Erro nunca só por cor: borda vermelha + ícone + texto em tinta (alarme sobre areia reprova no contraste).
export function Campo({ rotulo, valor, onChangeText, erro, style, ...resto }: CampoProps) {
  return (
    <View style={estilos.bloco}>
      <Texto variante="legenda" style={estilos.rotulo}>
        {rotulo}
      </Texto>
      <TextInput
        {...resto}
        accessibilityLabel={rotulo}
        accessibilityHint={erro ?? resto.accessibilityHint}
        value={valor}
        onChangeText={onChangeText}
        allowFontScaling
        placeholderTextColor={cores.petroleo}
        style={[estilos.entrada, erro ? estilos.entradaErro : null, style]}
      />
      {erro ? (
        <Texto variante="legenda" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {`⚠ ${erro}`}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { marginBottom: espacos.m },
  rotulo: { fontFamily: fontes.semibold, marginBottom: 4 },
  entrada: {
    minHeight: tamanhos.alvoMin,
    borderWidth: 2,
    borderColor: cores.petroleo,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 18,
    fontFamily: fontes.regular,
    color: cores.tinta,
    backgroundColor: cores.branco,
  },
  entradaErro: { borderColor: cores.alarme, borderWidth: 3 },
});
