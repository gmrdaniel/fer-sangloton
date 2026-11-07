# San Glotón · Menú web

Página estática y responsiva con el menú de San Glotón (Boneless · Alitas · Papas).
Los clientes arman su pedido y lo envían por WhatsApp. Solo pickup.

## Estructura

```
.
├── index.html          # Página completa (HTML + CSS + JS)
├── assets/             # Logo optimizado e íconos que usa la web
├── design/             # Archivos fuente (menú y logo originales), no se publican
├── vercel.json         # Configuración de Vercel
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
