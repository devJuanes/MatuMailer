# Publicar MatuMailer en npm

Solo publicas **un paquete**: `matumailer` (el SDK incluye todo lo necesario empaquetado; no hace falta `@matumailer/shared` en npm).

| Paquete              | ¿Publicar?                                          |
| -------------------- | --------------------------------------------------- |
| `matumailer`         | **Sí** — `npm install matumailer`                   |
| `@matumailer/shared` | **No** — uso interno del monorepo (`private: true`) |
| `matumailer-cli`     | Opcional más adelante                               |

---

## Requisitos (una sola vez)

```bash
npm login
npm whoami
```

---

## Publicar (recomendado)

Desde la raíz del repo:

```bash
npm run build -- --filter=@matumailer/shared --filter=matumailer
cd packages/sdk
npm publish --access public
```

O en un solo paso:

```bash
npm run publish:npm
```

Con 2FA:

```bash
npm publish --access public --otp=123456
```

---

## Error: `Scope not found` en `@matumailer/shared`

Significa que **no existe** la organización `@matumailer` en npm. **No publiques** `packages/shared`.

El SDK ya empaqueta las dependencias internas; publica solo `packages/sdk` como se indica arriba.

Si en el futuro quisieras publicar `@matumailer/shared` por separado:

1. Crear org: [https://www.npmjs.com/org/create](https://www.npmjs.com/org/create) → nombre `matumailer`
2. Quitar `"private": true` de `packages/shared/package.json`
3. Publicar con `npm publish --access public`

---

## Verificar

```bash
npm view matumailer
mkdir C:\temp\matumailer-test
cd C:\temp\matumailer-test
npm init -y
npm install matumailer
node -e "const { MatuMailer } = require('matumailer'); console.log(typeof MatuMailer)"
```

---

## Documentación para desarrolladores

**[SDK-GUIDE.md](./SDK-GUIDE.md)** — paso a paso, plantillas, correo libre, errores.

README en npm: `packages/sdk/README.md`.

---

## Actualizar versión

```bash
cd packages/sdk
npm version patch
npm run build
npm publish --access public
```

---

## Errores frecuentes

| Error                  | Solución                                                     |
| ---------------------- | ------------------------------------------------------------ |
| `Scope not found`      | No publiques `shared`; solo `cd packages/sdk && npm publish` |
| `402 Payment Required` | `npm publish --access public`                                |
| Versión ya publicada   | `npm version patch` antes de publicar                        |
| Falta `dist`           | `npm run build` en `packages/sdk`                            |

---

## No publicar

- `@matumailer/api`, `@matumailer/dashboard`, `@matumailer/database`
- `@matumailer/shared` (interno)
- `matumailer-platform` (raíz)
