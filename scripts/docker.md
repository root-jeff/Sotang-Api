# Docker — Comandos rápidos

## Levantar todo (primera vez o después de reiniciar)

```bash
docker compose up -d
```

## Ver estado de los contenedores

```bash
docker compose ps
```

## Ver logs en tiempo real

```bash
# Ambos servicios
docker compose logs -f

# Solo Postgres
docker compose logs -f postgres

# Solo Redis
docker compose logs -f redis
```

---

## PostgreSQL

```bash
# Conectarse a psql dentro del contenedor
docker exec -it sotang-postgres psql -U sotang -d sotang_db

# Listar tablas (dentro de psql)
\dt

# Ver estructura de una tabla
\d transacciones

# Salir de psql
\q
```

```bash
# Backup manual de la base de datos
docker exec sotang-postgres pg_dump -U sotang sotang_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i sotang-postgres psql -U sotang -d sotang_db < backup_YYYYMMDD.sql
```

---

## Redis

```bash
# Conectarse a redis-cli dentro del contenedor
docker exec -it sotang-redis redis-cli

# Ver todas las keys (dentro de redis-cli)
KEYS *

# Ver info general
INFO

# Limpiar todo (¡cuidado en prod!)
FLUSHALL

# Salir
exit
```

---

## Parar / reiniciar / destruir

```bash
# Pausar contenedores (datos se conservan)
docker compose stop

# Reiniciar contenedores
docker compose restart

# Destruir contenedores Y volúmenes (borra todos los datos)
docker compose down -v
```

---

## Drizzle — migraciones

```bash
# Generar migración desde el schema
npm run db:generate

# Aplicar migraciones pendientes
npm run db:migrate

# Abrir Drizzle Studio (UI visual de la DB)
npm run db:studio
```

---

## Flujo completo desde cero

```bash
# 1. Levantar DB y Redis
docker compose up -d

# 2. Instalar dependencias
npm install

# 3. Generar y aplicar migración inicial
npm run db:generate
npm run db:migrate

# 4. Arrancar servidor en modo dev
npm run dev
# → http://localhost:3000/health
# → http://localhost:3000/documentation (Swagger UI)
```
