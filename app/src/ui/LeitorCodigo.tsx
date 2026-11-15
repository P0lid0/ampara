import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { cores } from '../theme/tokens';
import { Texto } from './Texto';

export type TipoCodigo = 'code128' | 'code39' | 'qr';

export type LeitorCodigoProps = {
  tipos: TipoCodigo[];
  aoLer: (valor: string) => void;
  aoNegar: () => void;
};

// Pede a permissão da câmera ao abrir; negada (ou sem como pedir de novo) chama aoNegar.
export function LeitorCodigo({ tipos, aoLer, aoNegar }: LeitorCodigoProps) {
  const [permissao, pedir] = useCameraPermissions();
  const lido = useRef(false);
  const negou = useRef(false);
  const atual = useRef({ pedir, aoNegar });
  // Atribuição no render de propósito: o efeito lê sempre a versão mais recente sem depender de identidades instáveis.
  atual.current = { pedir, aoNegar };

  const carregada = permissao !== null;
  const concedida = permissao?.granted ?? false;
  const podePedir = permissao?.canAskAgain ?? true;

  useEffect(() => {
    if (!carregada || concedida) return;
    const negar = () => {
      if (negou.current) return;
      negou.current = true;
      atual.current.aoNegar();
    };
    if (!podePedir) {
      negar();
      return;
    }
    atual.current
      .pedir()
      .then((r) => {
        if (!r.granted) negar();
      })
      .catch(negar);
  }, [carregada, concedida, podePedir]);

  if (!concedida) return <Texto accessibilityLiveRegion="polite">Abrindo a câmera...</Texto>;

  return (
    <View style={estilos.caixa} accessibilityLabel="Câmera aberta para ler o código de barras">
      <CameraView
        style={estilos.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: tipos }}
        onBarcodeScanned={({ data }) => {
          if (lido.current) return;
          lido.current = true;
          aoLer(data);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { height: 260, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: cores.petroleo },
  camera: { flex: 1 },
});
