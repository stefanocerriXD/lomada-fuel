# Backup de Lomada Fuel

El plan gratis de Supabase no deja bajar backups, así que este script baja todo a tu compu:

- **La base entera** (`datos.sql`): todas las tablas de la app y las cuentas (con la contraseña cifrada, así se puede volver a entrar igual).
- **Las fotos, audios e imágenes** (carpeta `fotos/`): la primera vez baja todo; después, solo lo nuevo.

## Prepararlo (una sola vez)

1. Copiá `scripts/env.backup.ejemplo` a `.env.backup` en la raíz del proyecto.
2. Completá `SUPABASE_DB_URL` con la conexión de Supabase (botón **Connect** > **Session pooler**) y la contraseña de la base.
3. Para las fotos, completá `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (Project Settings > API Keys > Secret key).

`.env.backup` está en `.gitignore`: nunca se sube. Las claves no se pegan en ningún chat.

## Hacer un backup

```
npm run backup                 # base + fotos nuevas
npm run backup -- --sin-fotos  # solo la base
```

Queda en `lomada-backups/` al lado del proyecto (o en `BACKUP_CARPETA`):

```
lomada-backups/
  2026-11-18_2130/datos.sql      la base de ese momento
  2026-11-18_2130/resumen.json   cuántas filas tenía cada tabla
  fotos/                          todas las fotos (una sola carpeta que se va completando)
```

Se guardan los últimos 8 backups de la base (`BACKUP_GUARDAR` para cambiarlo). Conviene que `BACKUP_CARPETA` esté dentro de OneDrive, así también queda en la nube.

### Que se haga solo cada semana (Windows)

```
schtasks /create /tn "Lomada backup" /sc weekly /d DOM /st 21:00 /tr "cmd /c cd /d C:\ruta\al\proyecto && npm run backup >> lomada-backup.log 2>&1"
```

La compu tiene que estar prendida a esa hora.

## Restaurar

1. En el proyecto de Supabase (uno nuevo o el mismo), crear las tablas: en el SQL Editor correr `supabase/schema.sql` y después cada `supabase/0XX_*.sql` en orden.
2. Correr el `datos.sql` del backup en el SQL Editor (o con `psql`). No pisa lo que ya exista y no manda avisos mientras carga.
3. Las fotos: `npm run backup -- --restaurar-fotos ../lomada-backups/fotos`.

El circuito completo (bajar, vaciar la base, restaurar y comparar) está probado en `pruebas/sql/todo.mjs`.
