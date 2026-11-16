// Identidade visual do Ampara (contratos, seção "Identidade").
// As quatro cores da marca (petróleo, esmeralda, areia, alarme) não mudam;
// se um par de texto reprovar no contraste, escurece-se a cor do TEXTO.
export const cores = {
  petroleo: '#0F4C4A',
  esmeralda: '#14B88A',
  areia: '#F4EFE6',
  alarme: '#E5484D',
  tinta: '#12201F',
  sobreAlarme: '#000000',
  branco: '#FFFFFF',
  // Tons derivados da marca (MOBILE-DESIGN.md). As quatro cores da marca não mudam.
  areiaFunda: '#E8E1D2', // superfície tonal: botão secundário, esqueleto, linha pressionada
  esmeraldaSuave: '#DDF3EA', // fundo de "feito" e "conectado"
  alarmeSuave: '#FBE3E4', // fundo de aviso de erro em tela clara
  alarmeTexto: '#A3262B', // texto de erro e de ação destrutiva sobre areia ou branco (alarme puro dá 3,4:1)
  textoSuave: '#4A5B59', // texto de apoio (legenda secundária)
  bordaSuave: '#CFC8B8', // divisor e contorno decorativo de 1 px; nunca limite de controle
} as const;

export type NomeCor = keyof typeof cores;

// Alvo de toque mínimo (dp) e fonte mínima (pt), critérios de acessibilidade.
export const tamanhos = {
  alvoMin: 48,
  fonteMin: 16,
  alvoAcao: 56, // ação principal ancorada na base
  alvoAlarme: 64, // "Estou ciente" e ações da tela de alarme
} as const;

// Famílias carregadas por @expo-google-fonts/manrope no _layout.
export const fontes = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const espacos = {
  xs: 4,
  p: 8,
  pm: 12,
  m: 16,
  g: 24,
  gg: 32,
  xg: 48,
} as const;

// Escala de tipo. `teto` é o maxFontSizeMultiplier: null = sem teto (texto de leitura nunca é travado).
// O piso de 16 vale para todas as variantes (o componente Texto já garante).
export const tipo = {
  exibicao: { fontSize: 32, lineHeight: 40, fontFamily: fontes.bold, teto: 1.3 },
  titulo: { fontSize: 26, lineHeight: 34, fontFamily: fontes.bold, teto: 1.6 },
  secao: { fontSize: 20, lineHeight: 28, fontFamily: fontes.bold, teto: 1.6 },
  corpo: { fontSize: 18, lineHeight: 26, fontFamily: fontes.regular, teto: null },
  corpoForte: { fontSize: 18, lineHeight: 26, fontFamily: fontes.semibold, teto: null },
  rotulo: { fontSize: 16, lineHeight: 22, fontFamily: fontes.semibold, teto: 1.6 },
  legenda: { fontSize: 16, lineHeight: 22, fontFamily: fontes.regular, teto: null },
} as const;

// Teto de escala do rótulo da aba (4 abas em 360 dp: "Histórico" a 2x não cabe).
export const tetoRotuloAba = 1.3;

export const raios = {
  p: 8,
  m: 12, // padrão atual (19 usos)
  g: 16, // bloco herói e folha
  pilula: 999, // selo e chip
} as const;

export const bordas = {
  fina: 1, // divisor, cartão, selo
  padrao: 2, // campo e botão secundário
  foco: 3, // erro e foco
} as const;

// Superfícies planas; só a barra de ação ancorada ganha sombra (boxShadow vale nas duas plataformas).
export const elevacao = {
  nenhuma: 'none',
  barra: '0 -2px 8px rgba(18, 32, 31, 0.10)',
} as const;

// Movimento funcional e curto (ms). Com "reduzir movimento" ligado, as durações viram 0.
export const movimento = {
  toque: 100,
  entrada: 200,
  saida: 150,
} as const;

// Háptica com o Vibration do React Native (ms), sem dependência nova. O padrão da sirene continua no alarme.
export const haptica = {
  confirmar: 15,
} as const;

// Cores de apoio fora da marca (mapa e interruptor). Hexadecimal só vive neste arquivo.
export const coresApoio = {
  ambar: '#F2B84B',
  cinzaSemDado: '#9AA3A2',
  cinzaChave: '#767676', // trilho do interruptor desligado (mapa e Ajustes): 4,0:1 sobre areia
} as const;

// Preenchimento das células de risco: a cor só reforça, o nível sempre vem escrito e no padrão da borda.
export const coresRisco = {
  baixo: cores.esmeralda,
  medio: coresApoio.ambar,
  alto: cores.alarme,
  sem: coresApoio.cinzaSemDado,
} as const;
