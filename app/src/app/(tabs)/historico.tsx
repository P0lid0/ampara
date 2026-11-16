// Aba Histórico: preenchida na Task 14 (ocorrências, rota e BO).
import { ScrollView, StyleSheet } from 'react-native';
import { espacos } from '../../theme/tokens';
import { Texto } from '../../ui/Texto';

export default function Historico() {
  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Texto variante="titulo">Histórico</Texto>
      <Texto>Em breve</Texto>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
