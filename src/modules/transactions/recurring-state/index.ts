// Patrón State — ciclo de vida de TransaccionRecurrente
// Configured → Pending → Notified → Executed → (Pending si continúa | terminal)
//          ↘ Cancelled (desde cualquier estado no terminal)
//
// Cada estado define la respuesta a los 4 eventos; las transiciones inválidas
// lanzan InvalidStateError — es estructuralmente imposible ejecutar dos veces.

export type RecurringStateName = 'configured' | 'pending' | 'notified' | 'executed' | 'cancelled';

export class InvalidStateError extends Error {
  constructor(from: RecurringStateName, event: string) {
    super(`INVALID_STATE_TRANSITION: no se puede ${event}() desde el estado '${from}'`);
    this.name = 'InvalidStateError';
  }
}

export interface RecurringContext {
  id: string;
  activa: boolean;
  proximaEjecucion: string;   // YYYY-MM-DD
  ultimaEjecucion: string | null;
  fechaFin: string | null;
  frecuencia: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'anual';
}

export interface IRecurringState {
  readonly name: RecurringStateName;
  /** Programa la próxima ocurrencia. Retorna el estado siguiente. */
  schedule(ctx: RecurringContext): RecurringStateName;
  /** Marca la notificación D-1 enviada. */
  notify(ctx: RecurringContext): RecurringStateName;
  /** Autoriza la ejecución de la ocurrencia. */
  execute(ctx: RecurringContext): RecurringStateName;
  /** Desactiva la recurrencia. */
  cancel(ctx: RecurringContext): RecurringStateName;
}

abstract class BaseState implements IRecurringState {
  abstract readonly name: RecurringStateName;
  schedule(_ctx: RecurringContext): RecurringStateName { throw new InvalidStateError(this.name, 'schedule'); }
  notify(_ctx: RecurringContext): RecurringStateName   { throw new InvalidStateError(this.name, 'notify'); }
  execute(_ctx: RecurringContext): RecurringStateName  { throw new InvalidStateError(this.name, 'execute'); }
  cancel(_ctx: RecurringContext): RecurringStateName {
    if (this.name === 'cancelled') throw new InvalidStateError(this.name, 'cancel');
    return 'cancelled';
  }
}

class ConfiguredState extends BaseState {
  readonly name = 'configured' as const;
  override schedule(): RecurringStateName { return 'pending'; }
}

class PendingState extends BaseState {
  readonly name = 'pending' as const;
  override notify(): RecurringStateName { return 'notified'; }
  // Ejecución directa permitida si la fecha llegó sin pasar por la notificación D-1
  override execute(ctx: RecurringContext): RecurringStateName {
    assertDue(ctx);
    return 'executed';
  }
}

class NotifiedState extends BaseState {
  readonly name = 'notified' as const;
  override execute(ctx: RecurringContext): RecurringStateName {
    assertDue(ctx);
    return 'executed';
  }
}

class ExecutedState extends BaseState {
  readonly name = 'executed' as const;
  // Si el ciclo continúa (proximaEjecucion <= fechaFin o sin fechaFin), vuelve a Pending
  override schedule(ctx: RecurringContext): RecurringStateName {
    if (ctx.fechaFin && ctx.proximaEjecucion > ctx.fechaFin) return 'executed'; // terminal
    return 'pending';
  }
}

class CancelledState extends BaseState {
  readonly name = 'cancelled' as const;
}

function assertDue(ctx: RecurringContext): void {
  const hoy = new Date().toISOString().slice(0, 10);
  if (ctx.proximaEjecucion > hoy) {
    throw new InvalidStateError('pending', `execute (proximaEjecucion ${ctx.proximaEjecucion} > hoy ${hoy})`);
  }
}

const STATES: Record<RecurringStateName, IRecurringState> = {
  configured: new ConfiguredState(),
  pending:    new PendingState(),
  notified:   new NotifiedState(),
  executed:   new ExecutedState(),
  cancelled:  new CancelledState(),
};

export function getState(name: RecurringStateName): IRecurringState {
  return STATES[name];
}

/** Calcula la siguiente ocurrencia según la frecuencia. */
export function nextOccurrence(fecha: string, frecuencia: RecurringContext['frecuencia']): string {
  const d = new Date(fecha + 'T00:00:00Z');
  switch (frecuencia) {
    case 'diaria':    d.setUTCDate(d.getUTCDate() + 1); break;
    case 'semanal':   d.setUTCDate(d.getUTCDate() + 7); break;
    case 'quincenal': d.setUTCDate(d.getUTCDate() + 15); break;
    case 'mensual':   d.setUTCMonth(d.getUTCMonth() + 1); break;
    case 'anual':     d.setUTCFullYear(d.getUTCFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}
