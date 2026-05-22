# Desplegar MatuMailer en tu VPS (PM2 + Nginx)

Dominio: **matucatalogo.com**

| Qué | Subdominio | Puerto interno |
|-----|------------|----------------|
| API (backend) | `api.matucatalogo.com` | 4001 |
| Dashboard (frontend) | `mail.matucatalogo.com` | 3015 |

---

## Antes de empezar (DNS)

En tu proveedor de dominio (GoDaddy, Cloudflare, etc.) crea dos registros **A** apuntando al **IP de tu VPS**:

- `api` → IP del servidor
- `mail` → IP del servidor

Espera 5–30 minutos a que propaguen.

---

## Pasos 1 y 2 (resumen — si aún no los hiciste)

Conéctate por SSH a tu servidor:

```bash
ssh tu_usuario@IP_DE_TU_SERVIDOR
```

```bash
sudo mkdir -p /var/www/matumailer
cd /var/www/matumailer
git clone https://github.com/devJuanes/MatuMailer.git .
npm install
```

Archivo `.env` en la raíz (copia de `.env.example` y rellena valores reales):

```bash
cp .env.example .env
nano .env
```

Mínimo en `.env`:

```env
PORT=4001
NODE_ENV=production
MATUDB_URL=...
MATUDB_PROJECT_ID=...
MATUDB_API_KEY=...
ENCRYPTION_KEY=una_clave_larga_de_32_caracteres_o_mas
CORS_ORIGIN=https://mail.matucatalogo.com
SCHEDULER_INTERVAL_MS=30000
```

Dashboard (obligatorio **antes** del build):

```bash
echo "NEXT_PUBLIC_API_URL=https://api.matucatalogo.com" > apps/dashboard/.env.production
npm run build
```

Comprueba que existan:

```bash
ls apps/api/dist/index.js
ls apps/dashboard/.next
```

---

## Paso 3 — PM2 (detallado)

### 3.1 ¿Qué es PM2?

Mantiene la API y el dashboard **encendidos** aunque cierres SSH o reinicies el servidor.

### 3.2 Instalar PM2 (una sola vez)

```bash
sudo npm install -g pm2
```

Comprueba:

```bash
pm2 -v
```

### 3.3 Editar la ruta del proyecto

Abre el archivo de configuración:

```bash
cd /var/www/matumailer
nano ecosystem.config.cjs
```

Si clonaste en otra carpeta, cambia la línea:

```javascript
const APP_DIR = '/var/www/matumailer';
```

Guarda: `Ctrl+O`, Enter, `Ctrl+X`.

### 3.4 Arrancar las dos apps

```bash
cd /var/www/matumailer
pm2 start ecosystem.config.cjs
```

Deberías ver algo como:

```
matumailer-api         online
matumailer-dashboard   online
```

### 3.5 Probar que responden (en el servidor)

```bash
curl http://127.0.0.1:4001/health
```

Debe devolver JSON con `"status":"ok"`.

```bash
curl -I http://127.0.0.1:3015
```

Debe devolver `HTTP/1.1 200` o `307`.

Si falla la API, revisa logs:

```bash
pm2 logs matumailer-api --lines 50
```

### 3.6 Guardar para que reinicie al boot

```bash
pm2 save
```

```bash
pm2 startup
```

PM2 mostrará un comando que empieza con `sudo env PATH=...` — **cópialo y ejecútalo** (una sola vez).

Luego otra vez:

```bash
pm2 save
```

### 3.7 Comandos útiles

| Comando | Para qué |
|---------|----------|
| `pm2 list` | Ver estado |
| `pm2 logs` | Ver errores en vivo |
| `pm2 restart all` | Tras `git pull` y nuevo build |
| `pm2 stop matumailer-api` | Parar solo la API |

---

## Paso 4 — Nginx (puente entre Internet y PM2)

### 4.1 Copiar configuraciones

```bash
sudo cp /var/www/matumailer/deploy/nginx-api.matucatalogo.com.conf /etc/nginx/sites-available/api.matucatalogo.com
sudo cp /var/www/matumailer/deploy/nginx-mail.matucatalogo.com.conf /etc/nginx/sites-available/mail.matucatalogo.com
```

### 4.2 Activar sitios

```bash
sudo ln -sf /etc/nginx/sites-available/api.matucatalogo.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/mail.matucatalogo.com /etc/nginx/sites-enabled/
```

### 4.3 Probar y recargar

```bash
sudo nginx -t
```

Si dice `syntax is ok`:

```bash
sudo systemctl reload nginx
```

---

## Paso 5 — HTTPS (Certbot, gratis)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.matucatalogo.com -d mail.matucatalogo.com
```

Sigue las preguntas (email, aceptar términos). Elige redirigir a HTTPS si pregunta.

Renovación automática suele quedar ya configurada.

---

## Paso 6 — Probar en el navegador

| URL | Esperado |
|-----|----------|
| https://api.matucatalogo.com/health | JSON ok |
| https://api.matucatalogo.com/docs | Swagger |
| https://mail.matucatalogo.com | Login MatuMailer |

Regístrate, configura SMTP, genera token.

---

## Actualizar después de cambios en GitHub

```bash
cd /var/www/matumailer
git pull
npm install
npm run build
pm2 restart all
```

Si cambias `NEXT_PUBLIC_API_URL`, vuelve a crear `apps/dashboard/.env.production` y `npm run build` antes del restart.

---

## Problemas frecuentes

**Puerto ocupado:** cambia `4001` o `3015` en `ecosystem.config.cjs` y en los archivos nginx `deploy/`, luego `pm2 restart all` y `sudo nginx -t && sudo systemctl reload nginx`.

**CORS / login falla:** `CORS_ORIGIN` en `.env` debe ser exactamente `https://mail.matucatalogo.com`.

**502 Bad Gateway:** PM2 no está corriendo → `pm2 list` y `pm2 logs`.
