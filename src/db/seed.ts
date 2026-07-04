import { getDb, closePool } from '../core/db';
import { categories } from './schema/index';
import { isNull, and, eq } from 'drizzle-orm';

// Categorías de sistema (usuario_id = NULL, es_sistema = true): 9 de gasto + 3 de ingreso
const SYSTEM_CATEGORIES: { nombre: string; tipo: 'gasto' | 'ingreso'; color: string; icono: string; orden: number }[] = [
  { nombre: 'Alimentación',        tipo: 'gasto',   color: '#f59e0b', icono: 'restaurant',  orden: 1 },
  { nombre: 'Transporte',          tipo: 'gasto',   color: '#3b82f6', icono: 'car',         orden: 2 },
  { nombre: 'Vivienda',            tipo: 'gasto',   color: '#8b5cf6', icono: 'home',        orden: 3 },
  { nombre: 'Servicios Básicos',   tipo: 'gasto',   color: '#06b6d4', icono: 'flash',       orden: 4 },
  { nombre: 'Salud',               tipo: 'gasto',   color: '#ef4444', icono: 'medkit',      orden: 5 },
  { nombre: 'Entretenimiento',     tipo: 'gasto',   color: '#ec4899', icono: 'game-controller', orden: 6 },
  { nombre: 'Educación',           tipo: 'gasto',   color: '#10b981', icono: 'school',      orden: 7 },
  { nombre: 'Suscripciones',       tipo: 'gasto',   color: '#6366f1', icono: 'repeat',      orden: 8 },
  { nombre: 'Otros Gastos',        tipo: 'gasto',   color: '#64748b', icono: 'ellipsis-horizontal', orden: 9 },
  { nombre: 'Salario',             tipo: 'ingreso', color: '#10b981', icono: 'cash',        orden: 1 },
  { nombre: 'Freelance',           tipo: 'ingreso', color: '#0ea5e9', icono: 'laptop',      orden: 2 },
  { nombre: 'Otros Ingresos',      tipo: 'ingreso', color: '#64748b', icono: 'add-circle',  orden: 3 },
];

export async function seedSystemCategories() {
  const db = getDb();
  let created = 0;
  for (const cat of SYSTEM_CATEGORIES) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.usuarioId), eq(categories.nombre, cat.nombre)));
    if (existing) continue;
    await db.insert(categories).values({ ...cat, usuarioId: null, esSistema: true, activa: true });
    created++;
  }
  return { total: SYSTEM_CATEGORIES.length, created };
}

// Ejecutable directo: npm run db:seed
if (require.main === module) {
  seedSystemCategories()
    .then(r => {
      console.log(`✅ Seed completo: ${r.created} categorías creadas (${r.total - r.created} ya existían)`);
      return closePool();
    })
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
