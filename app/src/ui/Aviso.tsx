import { StyleSheet, View } from 'react-native';
import { cores, espacos, raios } from '../theme/tokens';
import { Icone } from './Icone';
import { Texto } from './Texto';

export type AvisoProps = { mensagem: string };

// Mensagem de erro em linha: ícone + texto em alarmeTexto sobre alarmeSuave (nunca só cor), anunciada ao leitor de tela.
export function Aviso({ mensagem }: AvisoProps) {
  return (
    <View style={estilos.caixa} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icone nome="alerta" tamanho={20} cor={cores.alarmeTexto} />
      <Texto variante="legenda" style={estilos.texto}>
        {mensagem}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.p,
    padding: espacos.pm,
    borderRadius: raios.m,
    backgroundColor: cores.alarmeSuave,
  },
  texto: { flex: 1, color: cores.alarmeTexto },
});
