# San Glotón · Menú web

Página estática y responsiva con el menú de San Glotón (Boneless · Alitas · Papas).
Los clientes arman su pedido y lo envían por WhatsApp. Solo pickup.

## Estructura

```
.
├── index.html          # Página completa (HTML + CSS + JS)
├── privacidad.html     # Aviso de privacidad (/privacidad)
├── api/pedido.js       # Función de Vercel: registra pedidos en Google Sheets
├── assets/             # Logo optimizado e íconos que usa la web
├── design/             # Archivos fuente (menú y logo originales), no se publican
├── vercel.json         # Configuración de Vercel
├── manifest.json       # Ícono/nombre al agregar a pantalla de inicio
├── robots.txt, sitemap.xml
├── favicon.ico
├── .env.example        # Plantilla de variables
└── .gitignore
```

## Editar precios o productos

En `index.html`, busca el bloque `CONFIGURACIÓN` dentro del `<script>`.

> Nota: la página es estática (sin build), así que el navegador no lee `.env`.
> Los valores de `.env` sirven como referencia; el número de WhatsApp vive en `WHATSAPP` dentro de `index.html`.

## Desarrollo local

Abre `index.html` en el navegador, o sirve la carpeta:

```
npx serve .
```

## Deploy en Vercel

Importa el repo en Vercel con framework **Other** (sin build command, output = raíz).

## Vista previa al compartir

La imagen para redes es `assets/og-image.jpg` (1200×630). Si cambias el dominio, actualiza las URLs
absolutas en `index.html` (canonical, og:*, twitter:*, JSON-LD), `robots.txt` y `sitemap.xml`.
Para refrescar la vista previa en Facebook/WhatsApp usa https://developers.facebook.com/tools/debug/

## Registro de pedidos (Google Sheets)

Al enviar, la página genera un folio (`SG-XXXXX`), lo incluye en el mensaje de WhatsApp y registra
el pedido en la hoja con estado **Intento**. Cuando el cliente regresa y confirma "Sí, ya lo envié",
cambia a **Confirmado**. Si las variables no están configuradas, la página funciona igual (solo no registra).

Columnas: Folio · Fecha · Nombre · Teléfono · Pedido · Total · Hora recoger · Notas · Dispositivo · Estado · Confirmado.
No se guarda la IP (solo se usa en memoria para limitar abusos).

Configuración:
1. Google Cloud → crear proyecto → habilitar **Google Sheets API**.
2. IAM → Cuentas de servicio → crear una → Claves → Agregar clave → JSON.
3. Compartir la hoja con el `client_email` de la cuenta de servicio como **Editor**.
4. En Vercel, agregar las variables de `.env.example` (Production y Preview) y volver a desplegar.
