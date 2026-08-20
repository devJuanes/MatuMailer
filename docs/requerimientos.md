# MatuMailer — Migración completa a dominios verificados y aliases

Quiero que analices y modifiques **TODO el proyecto de MatuMailer** (`matumailer.matubyte.com`) para cambiar definitivamente la arquitectura de envío de correos.

## OBJETIVO PRINCIPAL

MatuMailer **NO debe volver a utilizar credenciales SMTP proporcionadas manualmente por el usuario**.

Eliminar completamente del flujo de producto:

* Servidores SMTP personalizados introducidos por el usuario.
* Usuario SMTP.
* Contraseña SMTP.
* Contraseñas de aplicación de Google.
* Credenciales de Gmail/Outlook para enviar.
* Formularios donde el usuario configure host, puerto, usuario y contraseña SMTP.
* Cualquier lógica que dependa de `nodemailer` + credenciales SMTP del cliente.
* Cualquier endpoint relacionado con guardar, editar, validar o probar credenciales SMTP.
* Cualquier variable, tabla, modelo, servicio o configuración que exista únicamente para soportar este sistema anterior.

El nuevo modelo debe basarse exclusivamente en:

**Dominio verificado por DNS → identidad de envío → alias → envío.**

Antes de modificar código, analiza la arquitectura completa del proyecto y encuentra todas las partes relacionadas con:

* SMTP
* Email sending
* Domains
* DNS verification
* Aliases
* Campaigns
* Templates
* API
* SDK
* Authentication
* Database
* Queues/jobs
* Logs
* Webhooks
* Rate limits
* Email providers
* Sending identities

No hagas cambios parciales. Quiero una migración coherente de extremo a extremo.

---

# 1. DOMINIOS VERIFICADOS

La funcionalidad de dominios verificados por DNS **ya existe**.

Debes reutilizarla y mejorarla si es necesario.

El usuario debe poder:

* Registrar un dominio.
* Obtener los registros DNS necesarios.
* Verificar el dominio.
* Consultar el estado de verificación.
* Volver a verificar.
* Ver claramente cuándo el dominio está listo para enviar.
* Ver errores de configuración DNS.
* Gestionar múltiples dominios.

Ejemplo:

```text
example.com
status: verified
```

Una vez que un dominio esté verificado, se considera una identidad válida para realizar envíos.

---

# 2. ALIASES

La funcionalidad de aliases también existe actualmente.

Debe quedar integrada directamente con el nuevo sistema de envío.

Un alias debe estar asociado obligatoriamente a un dominio verificado.

Ejemplo:

```text
soporte@example.com
ventas@example.com
facturacion@example.com
hello@example.com
```

Internamente manejar correctamente:

```text
alias
domain
email
display_name
status
verification_status
```

La dirección completa debe construirse de forma segura:

```text
alias + "@" + domain
```

Pero no depender únicamente de concatenaciones en frontend.

El backend debe validar siempre:

1. Que el dominio existe.
2. Que pertenece al usuario/proyecto correspondiente.
3. Que está verificado.
4. Que el alias existe.
5. Que el alias está habilitado.
6. Que el alias pertenece al dominio seleccionado.
7. Que el usuario tiene permisos para enviar desde esa identidad.

---

# 3. MODELO MULTI-DOMINIO

El sistema debe soportar múltiples dominios.

Ejemplo:

```text
example.com
example.net
example.co
```

Y dentro de ellos:

```text
ventas@example.com
soporte@example.com

ventas@example.net
support@example.net

hello@example.co
```

No asumir nunca que un usuario solamente tendrá un dominio.

La arquitectura debe ser preparada desde ahora para:

```text
User
  └── Projects
        ├── Domains
        │     ├── Domain A
        │     └── Domain B
        │
        └── Sending Identities
              ├── Alias A
              ├── Alias B
              └── Alias C
```

---

# 4. CONCEPTO DE PROYECTOS

Quiero que evalúes seriamente introducir el concepto de **Project** como nivel principal de aislamiento.

La arquitectura ideal debería ser:

```text
Account
   ↓
Projects
   ↓
Domains
   ↓
Aliases / Sending Identities
   ↓
Emails
   ↓
Campaigns
```

Esto permitiría que un proyecto tenga sus propios dominios y remitentes.

Ejemplo:

```text
Proyecto: Tienda ABC

Dominio:
abc.com

Aliases:
ventas@abc.com
soporte@abc.com
marketing@abc.com
```

Otro proyecto:

```text
Proyecto: MatuByte

Dominio:
matubyte.com

Aliases:
hola@matubyte.com
soporte@matubyte.com
facturacion@matubyte.com
```

Un usuario puede tener varios proyectos, pero los recursos deben quedar correctamente aislados.

---

# 5. DOMINIO POR DEFECTO

Necesitamos implementar una estrategia clara para determinar desde qué dirección se envía un correo.

Si el proyecto tiene:

```text
1 dominio
1 alias
```

ese alias puede convertirse automáticamente en el remitente predeterminado.

Ejemplo:

```text
soporte@example.com
```

Entonces una llamada sencilla:

```http
POST /api/v1/emails
```

puede enviar automáticamente desde:

```text
soporte@example.com
```

sin que el cliente tenga que especificarlo.

---

# 6. MÚLTIPLES ALIASES

Cuando el proyecto tenga múltiples aliases:

```text
ventas@example.com
soporte@example.com
marketing@example.com
```

la API debe permitir seleccionar explícitamente el remitente.

Ejemplo conceptual:

```json
{
  "from": {
    "alias": "ventas",
    "domain": "example.com"
  },
  "to": [
    {
      "email": "cliente@example.org"
    }
  ],
  "subject": "Nueva oferta",
  "html": "<h1>Hola</h1>"
}
```

Pero quiero que evalúes si existe una estructura mejor.

Preferiblemente evitar que el usuario tenga que enviar simultáneamente datos redundantes.

Por ejemplo, puede ser mejor utilizar:

```json
{
  "from": "ventas@example.com"
}
```

y que el backend resuelva:

```text
email
→ alias
→ domain
→ project
→ verified sending identity
```

Evalúa ambas alternativas y utiliza la que produzca una API más limpia y segura.

---

# 7. REMITENTE PREDETERMINADO

Implementar explícitamente:

```text
default_sending_identity
```

o una estructura equivalente.

Un proyecto debería poder tener:

```text
default sender:
soporte@example.com
```

Entonces:

```json
{
  "to": "cliente@example.com",
  "subject": "Hola",
  "html": "<p>Mensaje</p>"
}
```

debe funcionar si existe un remitente predeterminado válido.

Si existen múltiples aliases pero existe uno marcado como default, utilizar ese.

Si el usuario intenta enviar desde un alias específico, utilizar el alias solicitado.

Si no existe alias predeterminado y hay múltiples aliases, devolver un error claro indicando que debe especificarse el remitente.

---

# 8. API

Reestructurar la API para que el concepto de sender/identity sea de primera clase.

Por ejemplo:

```http
GET /api/v1/sending-identities
```

```http
GET /api/v1/sending-identities/:id
```

```http
POST /api/v1/emails
```

```http
POST /api/v1/emails/batch
```

```http
POST /api/v1/campaigns
```

Los endpoints existentes pueden mantenerse si son necesarios para compatibilidad, pero deben adaptarse a la nueva arquitectura.

La API debe poder resolver:

```text
project
→ domain
→ alias
→ sending identity
→ provider
→ delivery
```

sin que el usuario tenga que conocer ni enviar credenciales SMTP.

---

# 9. SDK

El SDK debe reflejar exactamente la misma arquitectura.

Debe ser posible hacer algo como:

```typescript
await mailer.emails.send({
  from: "ventas@example.com",
  to: "cliente@example.com",
  subject: "Hola",
  html: "<h1>Hola</h1>"
});
```

Y también permitir:

```typescript
await mailer.emails.send({
  to: "cliente@example.com",
  subject: "Hola",
  html: "<h1>Hola</h1>"
});
```

cuando exista un sender predeterminado.

También debe existir una forma limpia de consultar las identidades:

```typescript
await mailer.sendingIdentities.list()
```

y posiblemente:

```typescript
await mailer.domains.list()
```

y:

```typescript
await mailer.aliases.list()
```

No quiero que el SDK tenga ningún concepto relacionado con:

```typescript
smtpHost
smtpPort
smtpUser
smtpPassword
appPassword
gmailPassword
```

---

# 10. IMPORTANTE: EL USUARIO NO MANEJA CREDENCIALES SMTP

Esta es una regla fundamental de la nueva arquitectura.

El usuario de MatuMailer únicamente debe configurar:

```text
Dominio
↓
DNS
↓
Verificación
↓
Alias
↓
Envío
```

No debe aparecer ningún formulario que solicite:

```text
SMTP Host
SMTP Port
SMTP Username
SMTP Password
App Password
```

Eliminar completamente estos conceptos de la UI.

---

# 11. BACKEND DE ENVÍO

Aquí debes analizar cómo está implementado actualmente el envío.

No quiero simplemente eliminar Nodemailer.

Necesito que determines cuál será el mecanismo real de entrega de los mensajes.

La arquitectura debe quedar preparada para utilizar un proveedor de email transaccional/API de MatuMailer.

La aplicación debe actuar como plataforma:

```text
Cliente
   ↓
MatuMailer API
   ↓
Validación de Project
   ↓
Validación de Domain
   ↓
Validación de Sending Identity
   ↓
Email Provider
   ↓
Internet
   ↓
Destinatario
```

El proveedor real debe estar encapsulado detrás de una capa de abstracción.

Por ejemplo:

```typescript
EmailProvider
```

con una interfaz similar a:

```typescript
interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}
```

De esta manera MatuMailer no queda acoplado directamente a un proveedor específico.

---

# 12. SENDER RESOLUTION

Crear una lógica centralizada para resolver el remitente.

Ejemplo conceptual:

```typescript
resolveSendingIdentity({
  projectId,
  requestedFrom
})
```

Debe:

1. Obtener el proyecto.
2. Si `from` fue enviado:

   * localizar la identidad.
3. Validar que pertenece al proyecto.
4. Validar dominio.
5. Validar dominio verificado.
6. Validar alias.
7. Validar que está habilitado.
8. Resolver la dirección final.
9. Resolver el proveedor de envío.
10. Autorizar el envío.

Nunca confiar en que el frontend envió una dirección válida.

---

# 13. SEGURIDAD

Prevenir:

```text
Project A
↓
usar alias de
↓
Project B
```

También prevenir:

```text
Usuario A
↓
usar dominio de
↓
Usuario B
```

Toda identidad debe estar vinculada correctamente al tenant/project.

Validar siempre en backend.

Nunca aceptar simplemente:

```json
{
  "from": "cualquiercorreo@dominio.com"
}
```

y asumir que es válido.

El backend debe comprobar que esa identidad existe dentro del proyecto y que el dominio está verificado.

---

# 14. BASE DE DATOS

Analiza el esquema actual y determina si los modelos existentes son suficientes.

La estructura conceptual debería permitir algo parecido a:

```text
Project
 ├── Domain
 │     ├── verificationStatus
 │     ├── dnsRecords
 │     └── providerConfiguration
 │
 └── SendingIdentity
       ├── alias
       ├── email
       ├── displayName
       ├── domainId
       ├── isDefault
       ├── status
       └── verificationStatus
```

No dupliques información innecesariamente.

Si actualmente `Alias` y `Domain` ya existen, reutilízalos y realiza las migraciones necesarias.

No crees modelos duplicados solamente por cambiar el nombre.

---

# 15. DASHBOARD DE ENVÍO

La interfaz de envío debe cambiar.

Actualmente puede existir lógica basada en SMTP.

Eso debe desaparecer.

El usuario debe ver algo similar a:

```text
Enviar correo

Desde
[ soporte@example.com ▼ ]

Para
[ cliente@example.com ]

Asunto
[ Nueva información ]

Contenido
[ ... ]

[ Enviar ]
```

Si solamente existe un sender:

```text
Desde
support@example.com
```

y puede mostrarse automáticamente.

Si existen múltiples:

```text
Desde
[ ventas@example.com ▼ ]
```

Debe poder seleccionarse.

Mostrar únicamente identities que estén listas para enviar.

---

# 16. CAMPAÑAS

Revisar también las campañas.

Una campaña debe tener un sender asociado.

Ejemplo:

```text
Campaign
    ↓
Sending Identity
    ↓
ventas@example.com
```

Cuando se ejecuta la campaña, todos los mensajes deben utilizar esa identidad salvo que la arquitectura actual contemple una estrategia distinta.

No permitir que una campaña utilice accidentalmente un dominio no verificado.

---

# 17. TEMPLATES

Los templates no deberían almacenar credenciales SMTP.

Deben permanecer independientes del mecanismo de transporte.

Ejemplo:

```text
Template
↓
Campaign
↓
Sending Identity
↓
Provider
```

No:

```text
Template
↓
SMTP Credentials
```

---

# 18. LOGS

Los logs de envío deben registrar información útil como:

```text
messageId
projectId
domainId
sendingIdentityId
from
to
provider
status
createdAt
sentAt
error
```

Nunca registrar:

```text
SMTP password
API secrets
private credentials
```

---

# 19. ERRORES

Crear errores claros.

Ejemplos:

```text
SENDING_IDENTITY_NOT_FOUND
```

```text
SENDING_IDENTITY_NOT_VERIFIED
```

```text
DOMAIN_NOT_VERIFIED
```

```text
NO_DEFAULT_SENDING_IDENTITY
```

```text
SENDING_IDENTITY_NOT_ALLOWED
```

```text
SENDING_IDENTITY_DISABLED
```

```text
DOMAIN_NOT_ALLOWED_FOR_PROJECT
```

Los mensajes para el cliente deben ser entendibles.

---

# 20. UX DE DOMINIOS Y ALIASES

Revisa las pantallas actuales.

Quiero que el flujo sea intuitivo:

```text
Dominios
   ↓
Agregar dominio
   ↓
Mostrar DNS
   ↓
Verificar
   ↓
Dominio listo
   ↓
Crear alias
   ↓
Alias listo para enviar
```

Por ejemplo:

```text
example.com
✓ Dominio verificado

Aliases

✓ ventas@example.com
✓ soporte@example.com
✓ marketing@example.com
```

Desde ahí el usuario debe poder establecer:

```text
Marcar como remitente predeterminado
```

---

# 21. DOMINIO POR PROYECTO

Quiero que evalúes como arquitectura recomendada que:

**cada proyecto pueda tener su propio dominio o conjunto de dominios.**

Ejemplo:

```text
Proyecto: Mi tienda
Dominio: tienda.com

Proyecto: Mi newsletter
Dominio: newsletter.com

Proyecto: MatuByte
Dominio: matubyte.com
```

Esto ayuda a separar reputación, identidad, campañas y configuración.

Pero no fuerces esta restricción si la arquitectura actual puede soportar múltiples dominios de manera segura.

Diseña el sistema para soportar:

```text
1 proyecto → 1 dominio
```

pero también:

```text
1 proyecto → múltiples dominios
```

---

# 22. API KEYS

Revisar también las API keys.

La API key debe estar asociada a un proyecto.

Por ejemplo:

```text
MatuMailer
   ↓
API Key
   ↓
Project
   ↓
Sending Identities
```

Una API key de un proyecto nunca debe poder enviar utilizando identidades de otro proyecto.

Idealmente soportar permisos/scopes en el futuro.

Ejemplo:

```text
email:send
email:read
domains:read
aliases:read
```

No es obligatorio implementar todo si la arquitectura actual no lo requiere, pero deja el sistema preparado.

---

# 23. NO ROMPER LO EXISTENTE

Antes de modificar:

1. Analiza todo el proyecto.
2. Identifica frontend.
3. Identifica backend.
4. Identifica SDK.
5. Identifica API.
6. Identifica modelos.
7. Identifica migraciones.
8. Identifica servicios de email.
9. Identifica dominios.
10. Identifica aliases.
11. Identifica campañas.
12. Identifica templates.
13. Identifica logs.

Después crea un plan de migración.

No empieces eliminando archivos sin entender sus dependencias.

---

# 24. MIGRACIÓN

Si existen datos antiguos relacionados con SMTP:

```text
smtp_host
smtp_port
smtp_user
smtp_password
smtp_credentials
```

determina si deben:

* eliminarse,
* migrarse,
* marcarse deprecated,
* o mantenerse temporalmente solamente para compatibilidad interna.

Pero la nueva interfaz y la nueva arquitectura **no deben depender de ellos**.

Si no tienen utilidad futura, crear una migración para eliminarlos correctamente.

---

# 25. TESTS

Agregar o actualizar tests para comprobar:

### Dominio

```text
verified domain → allowed
unverified domain → rejected
```

### Alias

```text
verified alias → allowed
unknown alias → rejected
alias from another project → rejected
```

### Default sender

```text
one alias → automatic
multiple aliases + default → automatic
multiple aliases without default → error
explicit sender → selected sender
```

### Seguridad

```text
Project A cannot send from Project B
User A cannot use User B domain
```

### API

Probar:

```http
POST /api/v1/emails
```

con:

```json
{
  "from": "ventas@example.com",
  "to": "test@example.com",
  "subject": "Test",
  "html": "<p>Hello</p>"
}
```

y también:

```json
{
  "to": "test@example.com",
  "subject": "Test",
  "html": "<p>Hello</p>"
}
```

cuando existe un default sender.

---

# 26. DOCUMENTACIÓN

Actualizar toda la documentación.

Eliminar ejemplos de:

```text
SMTP password
Gmail App Password
SMTP credentials
```

La documentación nueva debe enseñar:

```text
1. Crear proyecto
2. Agregar dominio
3. Configurar DNS
4. Verificar dominio
5. Crear alias
6. Marcar sender predeterminado
7. Crear API key
8. Enviar correo mediante API/SDK
```

---

# 27. RESULTADO FINAL ESPERADO

La arquitectura final debe quedar conceptualmente así:

```text
                    MATUMAILER
                         │
                    ┌────▼────┐
                    │ Project │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              │                     │
          Domains               API Keys
              │
        DNS Verification
              │
       Verified Domain
              │
      Sending Identities
              │
      ┌───────┼────────┐
      │       │        │
    Sales   Support  Marketing
      │       │        │
      └───────┼────────┘
              │
           Email API
              │
        Sending Service
              │
        Email Provider
              │
         Recipient
```

La regla fundamental es:

> **MatuMailer no debe pedirle al usuario credenciales SMTP. El usuario verifica su dominio mediante DNS y utiliza aliases autorizados dentro de ese dominio para realizar envíos.**

---

# 28. TAREA FINAL

Quiero que trabajes sobre el proyecto completo.

No quiero solamente cambios visuales.

Quiero una migración real de:

```text
Frontend
Backend
Database
API
SDK
Email service
Domains
Aliases
Campaigns
Templates
Logs
Security
Tests
Documentation
```

Antes de modificar, analiza la estructura actual y dime:

1. Qué partes ya están correctamente implementadas.
2. Qué partes todavía dependen de SMTP.
3. Qué archivos/modelos/endpoints deben modificarse.
4. Qué archivos deben eliminarse.
5. Qué migraciones de base de datos son necesarias.
6. Qué arquitectura recomiendas.
7. Qué cambios harás.

Después de ese análisis, implementa la migración completa.

No inventes una arquitectura desconectada de lo que ya existe. **Reutiliza la implementación actual de dominios verificados y aliases**, mejorándola donde sea necesario.

El resultado debe sentirse como un producto profesional de email API, no como una aplicación que simplemente oculta la configuración SMTP.

La prioridad es:

**Seguridad → arquitectura multi-proyecto → dominios verificados → sending identities → API → SDK → UX → escalabilidad.**
