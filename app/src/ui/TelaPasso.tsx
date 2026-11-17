import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { PassoOnboarding } from '../onboarding/passos';
import { cores, espacos } from '../theme/tokens';
import { BarraAcao } from './BarraAcao';
import { ProgressoPassos } from './ProgressoPassos';
import { Icone, type NomeIcone } from './Icone';
import { Texto } from './Texto';

export type TelaPassoProps = {
  // Passo do onboarding: mostra "Passo X de 8" no topo. Sem ele (tela de entrada), não há contador.
  passo?: PassoOnboarding;
  // Um título só por tela (variante `titulo`).
  titulo: string;
  // Ícone grande (72 dp, petróleo) acima do título: ocupa o vazio das telas curtas. Decorativo (escondido do leitor).
  icone?: NomeIcone;
  children: ReactNode;
  // Ação principal e secundárias, ancoradas na base (BarraAcao: área segura e teclado).
  acao: ReactNode;
};

// Moldura das telas de passo e de entrada: contador de passo, um título, conteúdo que rola e a ação
// ancorada na base. O conteúdo rola por cima do respiro; a barra nunca some com a rolagem.
export function TelaPasso({ passo, icone, titulo, children, acao }: TelaPassoProps) {
  return (
    <View style={estilos.fundo}>
      <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {passo ? <ProgressoPassos passo={passo} /> : null}
        {icone ? <Icone nome={icone} tamanho={72} cor={cores.petroleo} /> : null}
        <Texto variante="titulo">{titulo}</Texto>
        {children}
      </ScrollView>
      <BarraAcao>{acao}</BarraAcao>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.areia },
  rolagem: { flex: 1 },
  conteudo: { padding: espacos.m, gap: espacos.m, paddingBottom: espacos.g },
});
