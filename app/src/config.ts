// URL base da API (sem /api/v1; quem chama concatena).
// Vazio ou ausente cai no padrão do emulador com a API local (10.0.2.2 = host do emulador).
// Com a API na VM: EXPO_PUBLIC_API_URL=http://10.0.2.2:8080. Na demonstração: URL do túnel.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5080';
