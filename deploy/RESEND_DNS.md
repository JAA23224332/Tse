# Registros de DNS para o Resend enviar e-mail como @segundoturno.blog

Cadastre os três registros abaixo no painel de DNS do domínio (Hostinger, nameservers
hermes/artemis.dns-parking.com). Depois de propagar (minutos a algumas horas), o Resend verifica
sozinho; ver status em https://vercel.com/d/dashboard/integrations/resend/icfg_4lYgCrzmgkHiDdzpGy0ZGVNl/resources/ir_E54VwTxTfQIqJ03f

| Tipo | Nome (host)            | Valor                                         | Prioridade |
|------|------------------------|-----------------------------------------------|------------|
| TXT  | resend._domainkey      | (ver abaixo, uma linha só)                    | —          |
| MX   | send                   | feedback-smtp.sa-east-1.amazonses.com         | 10         |
| TXT  | send                   | v=spf1 include:amazonses.com ~all             | —          |

Valor do TXT `resend._domainkey`:

p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDVTFEUJdHLyVLY/o0QQiTWlfpNWVRurEzX9woq1brIQXfJiXMMBzvLcg3PVk2SNVEtxCx7XUrttO9ZC1hD4Mpk6+17R+AldBL//NTNk0/upAG/pJQQgyw1tVD5LknqVLKUTXO7NljCejJGcDSOezzh5EVbKTDhGQh/iUHEyY3nHwIDAQAB

Observações
- Se o painel da Hostinger pedir o nome completo, use `resend._domainkey.segundoturno.blog` e `send.segundoturno.blog`.
- Até a verificação, o site envia com o remetente `onboarding@resend.dev`, que só entrega para a dona da conta.
- Depois de verificado, criar a variável `EMAIL_DE` no Vercel com `Painel 2º Turno <acesso@segundoturno.blog>` e republicar.
