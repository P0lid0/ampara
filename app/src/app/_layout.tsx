import { Stack } from 'expo-router';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { cores, fontes } from '../theme/tokens';

export default function Layout() {
  // Se a Manrope não carregar (erro), o app segue com a fonte do sistema.
  const [carregadas, erro] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold });

  if (!carregadas && !erro) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.petroleo },
        headerTintColor: cores.areia,
        headerTitleStyle: carregadas ? { fontFamily: fontes.bold } : undefined,
        contentStyle: { backgroundColor: cores.areia },
      }}
    />
  );
}
