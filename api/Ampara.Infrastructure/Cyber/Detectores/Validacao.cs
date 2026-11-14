using System.Text.RegularExpressions;

namespace Ampara.Infrastructure.Cyber.Detectores;

/// <summary>Bordas e conferências de dígito compartilhadas pelos detectores.</summary>
internal static class Validacao
{
    // Não casa colado em letra ou dígito (GUID, JWT, hash) nem em número decimal ("-23.5672490", "1.529.982.247-25").
    // Ponto: parte inteira de 1 a 3 dígitos (sem dígito antes) + "." antes, ou ".1" a ".999999" depois, é decimal.
    // Vírgula é separador de coluna em CSV ("id,cpf", "cpf,quantidade"): só vale como decimal pt-BR quando vem com
    // sinal ("-23,56724901234"). Assim "7,CPF", "CPF,3", "a1,CPF" e "a,b" continuam detectados.
    public const string Ini = @"(?<![0-9A-Za-z])(?<!(?<![0-9]|[0-9]-)[0-9]{1,3}\.)(?<!(?<![0-9])-[0-9]{1,3},)";
    public const string Fim = @"(?![0-9A-Za-z]|\.[0-9]{1,6}(?![0-9.\-]))";

    public static readonly TimeSpan Limite = TimeSpan.FromMilliseconds(250);

    public static Regex Rx(string padrao, RegexOptions extra = RegexOptions.None) =>
        new(padrao, RegexOptions.CultureInvariant | extra, Limite);

    public static string Digitos(string s) => new(s.Where(char.IsAsciiDigit).ToArray());

    public static bool CpfValido(string digitos)
    {
        if (digitos.Length != 11 || digitos.Distinct().Count() == 1) return false;
        return Dv(digitos, 9) == digitos[9] - '0' && Dv(digitos, 10) == digitos[10] - '0';

        static int Dv(string d, int n)
        {
            var soma = 0;
            for (var i = 0; i < n; i++) soma += (d[i] - '0') * (n + 1 - i);
            var r = soma * 10 % 11;
            return r == 10 ? 0 : r;
        }
    }

    public static bool Luhn(string digitos)
    {
        var soma = 0;
        var dobrar = false;
        for (var i = digitos.Length - 1; i >= 0; i--)
        {
            var d = digitos[i] - '0';
            if (dobrar) { d *= 2; if (d > 9) d -= 9; }
            soma += d;
            dobrar = !dobrar;
        }
        return soma % 10 == 0;
    }
}
