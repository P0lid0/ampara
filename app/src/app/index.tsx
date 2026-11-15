import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { espacos } from '../theme/tokens';
import { Texto } from '../ui/Texto';

// Tela inicial provisória; o fluxo de entrada chega nas próximas tarefas.
export default function Inicio() {
  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Ampara' }} />
      <Texto variante="titulo">Ampara</Texto>
      <Texto>Se o seu celular for roubado, o Ampara avisa os seus guardiões e mostra o passo a passo.</Texto>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
