import { Stack } from 'expo-router';
import { cores, fontes } from '../../theme/tokens';

// O cabeçalho mostra só o nome do app; o assunto e o "Passo X de 8" ficam na tela (um contador só).
// A seta de voltar fica visível: onde há para onde voltar, ela aparece (o primeiro passo pode não ter).
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        title: 'Ampara',
        headerStyle: { backgroundColor: cores.petroleo },
        headerTintColor: cores.areia,
        headerTitleStyle: { fontFamily: fontes.bold },
        contentStyle: { backgroundColor: cores.areia },
        headerBackVisible: true,
      }}
    />
  );
}
