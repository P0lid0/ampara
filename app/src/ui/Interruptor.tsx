import * as Haptics from 'expo-haptics';
import { StyleSheet, Switch, View } from 'react-native';
import { coresApoio, cores, espacos, tamanhos } from '../theme/tokens';
import { Texto } from './Texto';

export type InterruptorProps = {
  rotulo: string;
  dica?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
};

// Linha de interruptor: o estado vem ESCRITO ("Ligado" / "Desligado"), não só na posição e na cor do trilho.
// Desligado = trilho cinzaChave (3:1 sobre areia e branco) com a bolinha branca, visível mesmo parado.
export function Interruptor({ rotulo, dica, valor, aoMudar }: InterruptorProps) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.texto}>
        <Texto variante="corpoForte">{rotulo}</Texto>
        {dica ? <Texto variante="legenda" style={estilos.dica}>{dica}</Texto> : null}
      </View>
      <View style={estilos.chave}>
        <Texto variante="rotulo" style={valor ? estilos.ligado : estilos.desligado}>
          {valor ? 'Ligado' : 'Desligado'}
        </Texto>
        <Switch
          accessibilityLabel={rotulo}
          accessibilityHint={dica}
          value={valor}
          onValueChange={(v) => {
            Haptics.selectionAsync().catch(() => undefined);
            aoMudar(v);
          }}
          trackColor={{ true: cores.petroleo, false: coresApoio.cinzaChave }}
          thumbColor={cores.branco}
          style={estilos.interruptor}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.m, padding: espacos.m, minHeight: tamanhos.alvoAcao },
  texto: { flex: 1, gap: espacos.xs },
  dica: { color: cores.textoSuave },
  chave: { alignItems: 'center', gap: espacos.xs },
  ligado: { color: cores.petroleo },
  desligado: { color: cores.textoSuave },
  interruptor: { minWidth: tamanhos.alvoMin, minHeight: tamanhos.alvoMin },
});
