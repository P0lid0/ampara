// Aba Mapa: preenchida na Task 18 (mapa de risco e relatos).
import { ScrollView, StyleSheet } from 'react-native';
import { espacos } from '../../theme/tokens';
import { Texto } from '../../ui/Texto';

export default function Mapa() {
  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Texto variante="titulo">Mapa</Texto>
      <Texto>Em breve</Texto>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
