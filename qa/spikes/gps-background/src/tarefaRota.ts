import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const TASK_NAME = "ampara-rota";

// Definida no carregamento do modulo: o app em segundo plano precisa dela ja registrada.
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log("AMPARA_ERRO", error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  for (const l of locations) {
    // mesmo formato de item de POST /rota/pontos do contrato
    const ponto = {
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      precisao: l.coords.accuracy,
      em: new Date(l.timestamp).toISOString(),
    };
    console.log("AMPARA_PONTO " + JSON.stringify(ponto));
  }
});

export async function iniciarRota(): Promise<void> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    console.log("AMPARA_ERRO permissao em primeiro plano negada");
    return;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    console.log("AMPARA_ERRO permissao em segundo plano negada");
    return;
  }
  // O Expo restaura a tarefa persistida ao abrir o app e essa restauracao falha quando o app
  // ainda nao esta em primeiro plano; "ja iniciada" nao prova que esta ativa. Reinicia sempre.
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  // High, nao Balanced: no emulador o provedor fundido em Balanced nao entrega nenhum ponto
  // (testado: 0 pontos em 2 execucoes); em High os `geo fix` chegam como pontos.
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 0,
    foregroundService: {
      notificationTitle: "Ampara",
      notificationBody: "Registrando a rota",
    },
  });
}
