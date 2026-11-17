import { StyleSheet, View } from 'react-native';
import { PASSOS, numeroDoPasso, type PassoOnboarding } from '../onboarding/passos';
import { cores } from '../theme/tokens';
import { Texto } from './Texto';

// Progresso sempre em texto ("Passo 3 de 7"); a barra é só reforço visual.
export function ProgressoPassos({ passo }: { passo: PassoOnboarding }) {
  const n = numeroDoPasso(passo);
  return (
    <View style={estilos.bloco}>
      <Texto variante="legenda">{`Passo ${n} de ${PASSOS.length}`}</Texto>
      <View style={estilos.trilho} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[estilos.cheio, { width: `${(n / PASSOS.length) * 100}%` }]} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 4 },
  trilho: { height: 4, borderRadius: 2, backgroundColor: cores.bordaSuave, overflow: 'hidden' },
  cheio: { height: '100%', backgroundColor: cores.petroleo, borderRadius: 2 },
});
