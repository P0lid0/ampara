import "./src/tarefaRota";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { iniciarRota } from "./src/tarefaRota";

export default function App() {
  useEffect(() => {
    iniciarRota().catch((e) => console.log("AMPARA_ERRO", String(e)));
  }, []);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Ampara — teste de rota</Text>
    </View>
  );
}
