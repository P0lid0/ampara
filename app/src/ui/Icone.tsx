import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { cores } from '../theme/tokens';

// Ícones vetoriais do sistema de design (traço 2, grade 24). Sempre ao lado de texto: nunca substituem o rótulo.
// Ficam escondidos do leitor de tela; quem fala é o texto vizinho.
export type NomeIcone =
  | 'alerta'
  | 'ok'
  | 'chaveiro'
  | 'rota'
  | 'telefone'
  | 'link'
  | 'voltar'
  | 'info'
  | 'fechar'
  | 'parar'
  | 'teste'
  | 'ponto'
  | 'anel'
  | 'relogio';

export type IconeProps = {
  nome: NomeIcone;
  tamanho?: number;
  cor?: string;
  testID?: string;
};

const TRACO = 2;

function Desenho({ nome, cor }: { nome: NomeIcone; cor: string }) {
  const traco = { stroke: cor, strokeWidth: TRACO, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  switch (nome) {
    case 'alerta':
      return (
        <>
          <Path d="M12 3.5 22 20.5H2L12 3.5Z" {...traco} />
          <Path d="M12 10v4.5" {...traco} />
          <Circle cx={12} cy={17.5} r={1} fill={cor} />
        </>
      );
    case 'ok':
      return <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" {...traco} />;
    case 'chaveiro':
      return (
        <>
          <Circle cx={8} cy={15} r={4} {...traco} />
          <Path d="M11 12 20 3M16.5 6.5l2.5 2.5M14 9l2 2" {...traco} />
        </>
      );
    case 'rota':
      return (
        <>
          <Circle cx={6} cy={18} r={2.5} {...traco} />
          <Circle cx={18} cy={6} r={2.5} {...traco} />
          <Path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" {...traco} />
        </>
      );
    case 'telefone':
      return (
        <Path
          d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"
          {...traco}
        />
      );
    case 'link':
      return (
        <>
          <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" {...traco} />
          <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...traco} />
        </>
      );
    case 'voltar':
      return <Path d="M19 12H5M11 6l-6 6 6 6" {...traco} />;
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...traco} />
          <Path d="M12 11v5.5" {...traco} />
          <Circle cx={12} cy={7.8} r={1} fill={cor} />
        </>
      );
    case 'fechar':
      return <Path d="M6 6l12 12M18 6 6 18" {...traco} />;
    case 'parar':
      return <Rect x={6} y={6} width={12} height={12} rx={2} fill={cor} />;
    case 'teste':
      return <Path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z" {...traco} />;
    case 'ponto':
      return <Circle cx={12} cy={12} r={6} fill={cor} />;
    case 'anel':
      return <Circle cx={12} cy={12} r={6} {...traco} />;
    case 'relogio':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...traco} />
          <Path d="M12 7v5l3 2" {...traco} />
        </>
      );
  }
}

// O testID fica num View comum: o Svg escondido do leitor de tela some também das consultas dos testes.
export function Icone({ nome, tamanho = 24, cor = cores.tinta, testID }: IconeProps) {
  return (
    <View testID={testID} style={{ width: tamanho, height: tamanho }}>
      <Svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Desenho nome={nome} cor={cor} />
      </Svg>
    </View>
  );
}
