import { Stack } from 'expo-router';
import { cores, fontes } from '../../theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.petroleo },
        headerTintColor: cores.areia,
        headerTitleStyle: { fontFamily: fontes.bold },
        contentStyle: { backgroundColor: cores.areia },
        headerBackVisible: false,
      }}
    />
  );
}
