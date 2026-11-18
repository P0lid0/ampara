# Roteiro de narração do pitch de Testing do Ampara

Vídeo: `entrega/08-testing/ampara-pitch-testing.mp4`, 3:15, sem som. Grave a voz assistindo ao vídeo e mande o áudio (WAV ou MP3) para o Pedro, que junta os dois.

## Como gravar

- Fale pausado e claro, em tom de apresentação para um professor que avalia o trabalho. Cerca de 2 palavras por segundo cabem folgadas em cada trecho.
- Cada bloco tem o horário em que a cena começa e termina. Se o texto passar do tempo, corte palavras em vez de falar mais rápido.
- Os números estão escritos por extenso de propósito. Leia como está.
- Grave em lugar silencioso, com o celular a um palmo da boca. Faça um áudio só, do começo ao fim, ou um arquivo por bloco (numerados).
- Passar 1 ou 2 segundos de um bloco não tem problema: o Pedro ajusta.

## Texto

**0:00 a 0:03 | Abertura**
Ampara: qualidade que protege.

**0:03 a 0:13 | Visão geral**
Organizamos os testes em vinte Features, quarenta Test Cases e uma matriz que liga cada requisito ao teste que o prova.

**0:13 a 0:26 | As 20 Features**
As vinte Features cobrem a API, o app, o IoT, o machine learning, a cibersegurança e a infraestrutura. Nada do Ampara fica de fora.

**0:26 a 0:37 | Critérios de aceite**
Cada Feature tem critérios de aceite no formato dado, quando, então. Assim todo mundo sabe o que significa estar pronto.

**0:37 a 0:50 | Test Case positivo**
Este é um Test Case positivo. O guardião confirma que viu o alarme e conclui um passo do bloqueio. O teste prova que o caminho principal funciona.

**0:50 a 1:03 | Test Case negativo**
E este é o negativo. Se o guardião não confirma, o alarme escala para o próximo guardião. O Ampara não depende de uma pessoa só.

**1:03 a 1:25 | Matriz de rastreabilidade**
Na matriz, cada Feature tem dois testes: um que prova que funciona e outro que tenta quebrar. É assim que ligamos o requisito à evidência, e vemos o que está coberto.

**1:25 a 1:35 | Alarme confiável: duplicidade**
Alarme confiável. Se o mesmo alerta chega cinco vezes, vira uma ocorrência só.

**1:35 a 1:43 | Alarme confiável: sem broker**
E se o broker de mensagens cair, a API continua de pé.

**1:43 a 1:52 | Privacidade: dígito verificador**
Privacidade. Um número com dígito errado não vira CPF: o sistema confere antes de aceitar.

**1:52 a 2:05 | Privacidade: ataques à API**
Também atacamos a nossa própria API. Foram treze ataques, e treze resultados esperados.

**2:05 a 2:14 | Acessibilidade**
Acessibilidade. Com a fonte do sistema em duzentos por cento, as telas não quebram.

**2:14 a 2:37 | Testes do app**
No app, são seiscentos e oitenta e oito testes, em cinquenta e cinco suítes de Jest. Todos passam hoje.

**2:37 a 2:50 | Ponte da polícia**
Na ponte da polícia, em Python, duzentos e vinte e três testes passam e dois ficam pulados.

**2:50 a 3:00 | API em C#**
Na API, em C#, são quatrocentos e oitenta testes e quatorze ataques, com zero falhas, na rodada de quinze de novembro.

**3:00 a 3:10 | Resumo**
Resumindo: um alarme que não falha, dado que não vaza e um app para todos.

**3:10 a 3:15 | Fechamento**
Equipe CitizenTech. Ampara: qualidade que protege.
