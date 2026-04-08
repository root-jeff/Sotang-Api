"""Initial schema — 25 tablas, 12 enums, índices completos

Revision ID: 001
Revises:
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMPTZ

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ══════════════════════════════════════════════════════════════════════════
    # ENUMS — deben crearse antes que las tablas que los usan
    # ══════════════════════════════════════════════════════════════════════════

    op.execute("""
        CREATE TYPE notif_evento AS ENUM (
            'recurrente_dia_antes',
            'corte_tarjeta_dia_antes',
            'meta_completada',
            'meta_progreso',
            'presupuesto_alerta',
            'presupuesto_excedido',
            'deuda_vencida',
            'cuenta_cobrar_recordatorio',
            'backup_fallido',
            'crypto_precio_error'
        )
    """)

    op.execute("""
        CREATE TYPE cuenta_tipo AS ENUM (
            'banco',
            'tarjeta_credito',
            'efectivo',
            'ahorro_virtual',
            'ahorro_cuenta',
            'fondo_inversion',
            'cripto'
        )
    """)

    op.execute("CREATE TYPE txn_tipo AS ENUM ('ingreso', 'gasto', 'transferencia')")
    op.execute("CREATE TYPE txn_canal AS ENUM ('web', 'mobile', 'telegram', 'email')")
    op.execute("CREATE TYPE txn_estado AS ENUM ('completada', 'pendiente', 'en_proceso', 'anulada')")
    op.execute("CREATE TYPE recurrente_freq AS ENUM ('diaria', 'semanal', 'quincenal', 'mensual', 'anual')")
    op.execute("CREATE TYPE presupuesto_periodo AS ENUM ('mensual', 'semanal', 'anual', 'personalizado')")
    op.execute("CREATE TYPE meta_tipo AS ENUM ('cuenta_virtual', 'cuenta_especifica', 'libre')")

    op.execute("""
        CREATE TYPE activo_tipo AS ENUM (
            'vehiculo', 'inmueble', 'cripto', 'efectivo', 'inversion', 'objeto_valor', 'otro'
        )
    """)

    op.execute("""
        CREATE TYPE pasivo_tipo AS ENUM (
            'tarjeta_credito',
            'prestamo_personal',
            'prestamo_hipotecario',
            'prestamo_vehicular',
            'deuda_informal',
            'otro'
        )
    """)

    op.execute("CREATE TYPE cobrar_estado AS ENUM ('pendiente', 'parcial', 'cobrado', 'incobrable')")
    op.execute("CREATE TYPE deuda_informal_estado AS ENUM ('pendiente', 'parcial', 'pagado')")

    # ══════════════════════════════════════════════════════════════════════════
    # CORE
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "usuarios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nombre", sa.VARCHAR(100), nullable=False),
        sa.Column("email", sa.VARCHAR(255), nullable=False),
        sa.Column("password_hash", sa.VARCHAR(255), nullable=False),
        sa.Column("avatar_url", sa.VARCHAR(500), nullable=True),
        sa.Column("timezone", sa.VARCHAR(50), nullable=False, server_default="America/Guayaquil"),
        sa.Column("moneda", sa.VARCHAR(3), nullable=False, server_default="USD"),
        sa.Column("modo_ui", sa.VARCHAR(10), nullable=False, server_default="system"),
        sa.Column("telegram_chat_id", sa.VARCHAR(50), nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("email_verificado", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("ultimo_login", TIMESTAMPTZ, nullable=True),
        sa.UniqueConstraint("email", name="uq_usuarios_email"),
        sa.CheckConstraint("modo_ui IN ('light', 'dark', 'system')", name="ck_usuarios_modo_ui"),
    )

    op.create_table(
        "user_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("iva_porcentaje", sa.DECIMAL(5, 2), nullable=False, server_default="15.00"),
        sa.Column("alerta_presupuesto_pct", sa.SmallInteger, nullable=False, server_default="80"),
        sa.Column("dias_notif_recurrente", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("dias_notif_corte", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("auto_registrar_recurrentes", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("crypto_update_interval_min", sa.SmallInteger, nullable=False, server_default="30"),
        sa.Column("dia_inicio_semana", sa.SmallInteger, nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_user_settings_usuario", ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", name="uq_user_settings_usuario"),
        sa.CheckConstraint("alerta_presupuesto_pct BETWEEN 1 AND 100", name="ck_settings_alerta_pct"),
        sa.CheckConstraint("iva_porcentaje BETWEEN 0 AND 100", name="ck_settings_iva"),
    )

    op.create_table(
        "notification_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("evento", sa.Enum(name="notif_evento", create_type=False), nullable=False),
        sa.Column("canal_email", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("canal_telegram", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("canal_push", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_notif_pref_usuario", ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", "evento", name="uq_notif_pref_usuario_evento"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.VARCHAR(255), nullable=False),
        sa.Column("expira_en", TIMESTAMPTZ, nullable=False),
        sa.Column("revocado", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("ip_address", sa.VARCHAR(45), nullable=True),
        sa.Column("user_agent", sa.VARCHAR(500), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_refresh_tokens_usuario", ondelete="CASCADE"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # CATEGORIAS — self-referential FK se agrega después de crear la tabla
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "categorias",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=True),
        sa.Column("nombre", sa.VARCHAR(100), nullable=False),
        sa.Column("tipo", sa.VARCHAR(10), nullable=False),
        sa.Column("color", sa.VARCHAR(7), nullable=False, server_default="#6366f1"),
        sa.Column("icono", sa.VARCHAR(50), nullable=True),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("es_sistema", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("parent_id", UUID(as_uuid=True), nullable=True),
        sa.Column("orden", sa.SmallInteger, nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_categorias_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("tipo IN ('ingreso', 'gasto', 'ambos')", name="ck_categorias_tipo"),
        sa.CheckConstraint("parent_id != id", name="ck_categorias_no_self_parent"),
    )
    # FK autorreferencial: después de crear la tabla
    op.create_foreign_key(
        "fk_categorias_parent", "categorias", "categorias",
        ["parent_id"], ["id"], ondelete="SET NULL"
    )

    # ══════════════════════════════════════════════════════════════════════════
    # CUENTAS
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "cupos_grupos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(100), nullable=False),
        sa.Column("cupo_total", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_cupos_grupos_usuario", ondelete="CASCADE"),
    )

    op.create_table(
        "cuentas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(100), nullable=False),
        sa.Column("tipo", sa.Enum(name="cuenta_tipo", create_type=False), nullable=False),
        sa.Column("moneda", sa.VARCHAR(3), nullable=False, server_default="USD"),
        sa.Column("saldo_inicial", sa.DECIMAL(15, 2), nullable=False, server_default="0.00"),
        sa.Column("saldo_actual", sa.DECIMAL(15, 2), nullable=False, server_default="0.00"),
        sa.Column("color", sa.VARCHAR(7), nullable=False, server_default="#6366f1"),
        sa.Column("icono", sa.VARCHAR(50), nullable=True),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("incluir_en_total", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("orden", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_cuentas_usuario", ondelete="CASCADE"),
    )

    op.create_table(
        "tarjetas_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cupo_total", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("cupo_grupo_id", UUID(as_uuid=True), nullable=True),
        sa.Column("fecha_corte", sa.SmallInteger, nullable=False),
        sa.Column("fecha_pago", sa.SmallInteger, nullable=False),
        sa.Column("tasa_interes_anual", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("banco", sa.VARCHAR(100), nullable=True),
        sa.Column("ultimos_4", sa.VARCHAR(4), nullable=True),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_tarjetas_cuenta", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cupo_grupo_id"], ["cupos_grupos.id"], name="fk_tarjetas_cupo_grupo", ondelete="SET NULL"),
        sa.UniqueConstraint("cuenta_id", name="uq_tarjetas_cuenta"),
        sa.CheckConstraint("fecha_corte BETWEEN 1 AND 31", name="ck_tarjetas_fecha_corte"),
        sa.CheckConstraint("fecha_pago BETWEEN 1 AND 31", name="ck_tarjetas_fecha_pago"),
    )

    op.create_table(
        "cripto_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=False),
        sa.Column("simbolo", sa.VARCHAR(20), nullable=False),
        sa.Column("coingecko_id", sa.VARCHAR(100), nullable=False),
        sa.Column("cantidad", sa.DECIMAL(20, 8), nullable=False, server_default="0"),
        sa.Column("precio_compra_promedio", sa.DECIMAL(20, 8), nullable=True),
        sa.Column("precio_actual_usd", sa.DECIMAL(20, 8), nullable=True),
        sa.Column("precio_desactualizado", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("ultima_actualizacion", TIMESTAMPTZ, nullable=True),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_cripto_config_cuenta", ondelete="CASCADE"),
        sa.UniqueConstraint("cuenta_id", name="uq_cripto_config_cuenta"),
        sa.CheckConstraint("cantidad >= 0", name="ck_cripto_cantidad"),
    )

    op.create_table(
        "ahorro_virtual_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cuenta_padre_id", UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_ahorro_virtual_cuenta", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cuenta_padre_id"], ["cuentas.id"], name="fk_ahorro_virtual_padre", ondelete="CASCADE"),
        sa.UniqueConstraint("cuenta_id", name="uq_ahorro_virtual_cuenta"),
        sa.CheckConstraint("cuenta_id != cuenta_padre_id", name="ck_ahorro_virtual_no_self"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # TRANSACCIONES
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "etiquetas",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(50), nullable=False),
        sa.Column("color", sa.VARCHAR(7), nullable=False, server_default="#6366f1"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_etiquetas_usuario", ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", "nombre", name="uq_etiquetas_usuario_nombre"),
    )

    op.create_table(
        "transacciones_recurrentes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.Enum(name="txn_tipo", create_type=False), nullable=False),
        sa.Column("monto", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("categoria_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=False),
        sa.Column("descripcion", sa.VARCHAR(500), nullable=True),
        sa.Column("frecuencia", sa.Enum(name="recurrente_freq", create_type=False), nullable=False),
        sa.Column("dia_del_mes", sa.SmallInteger, nullable=True),
        sa.Column("dia_de_semana", sa.SmallInteger, nullable=True),
        sa.Column("fecha_inicio", sa.Date, nullable=False),
        sa.Column("fecha_fin", sa.Date, nullable=True),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("proxima_ejecucion", sa.Date, nullable=False),
        sa.Column("ultima_ejecucion", sa.Date, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_recurrentes_usuario", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.id"], name="fk_recurrentes_categoria", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_recurrentes_cuenta", ondelete="RESTRICT"),
        sa.CheckConstraint("monto > 0", name="ck_recurrentes_monto"),
        sa.CheckConstraint("dia_del_mes BETWEEN 1 AND 31", name="ck_recurrentes_dia_mes"),
        sa.CheckConstraint("dia_de_semana BETWEEN 0 AND 6", name="ck_recurrentes_dia_semana"),
        sa.CheckConstraint("fecha_fin IS NULL OR fecha_fin > fecha_inicio", name="ck_recurrentes_fechas"),
    )

    op.create_table(
        "transacciones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.Enum(name="txn_tipo", create_type=False), nullable=False),
        sa.Column("monto", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("monto_sin_iva", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("iva_monto", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("incluye_iva", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("categoria_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cuenta_destino_id", UUID(as_uuid=True), nullable=True),
        sa.Column("descripcion", sa.VARCHAR(500), nullable=True),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("canal", sa.Enum(name="txn_canal", create_type=False), nullable=False, server_default="web"),
        sa.Column("recurrente_id", UUID(as_uuid=True), nullable=True),
        sa.Column("estado", sa.Enum(name="txn_estado", create_type=False), nullable=False, server_default="completada"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("actualizado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_txn_usuario", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.id"], name="fk_txn_categoria", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_txn_cuenta", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cuenta_destino_id"], ["cuentas.id"], name="fk_txn_cuenta_destino", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recurrente_id"], ["transacciones_recurrentes.id"], name="fk_txn_recurrente", ondelete="SET NULL"),
        sa.CheckConstraint("monto > 0", name="ck_txn_monto"),
        sa.CheckConstraint("cuenta_id != cuenta_destino_id", name="ck_txn_cuentas_distintas"),
    )

    op.create_table(
        "transacciones_etiquetas",
        sa.Column("transaccion_id", UUID(as_uuid=True), nullable=False),
        sa.Column("etiqueta_id", UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["transaccion_id"], ["transacciones.id"], name="fk_txn_etq_transaccion", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["etiqueta_id"], ["etiquetas.id"], name="fk_txn_etq_etiqueta", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("transaccion_id", "etiqueta_id"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # PRESUPUESTOS Y METAS
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "presupuestos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("categoria_id", UUID(as_uuid=True), nullable=False),
        sa.Column("monto", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("periodo", sa.Enum(name="presupuesto_periodo", create_type=False), nullable=False),
        sa.Column("fecha_inicio", sa.Date, nullable=True),
        sa.Column("fecha_fin", sa.Date, nullable=True),
        sa.Column("alerta_porcentaje", sa.SmallInteger, nullable=False, server_default="80"),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_presupuestos_usuario", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.id"], name="fk_presupuestos_categoria", ondelete="RESTRICT"),
        sa.CheckConstraint("monto > 0", name="ck_presupuestos_monto"),
        sa.CheckConstraint("alerta_porcentaje BETWEEN 1 AND 100", name="ck_presupuestos_alerta"),
        sa.CheckConstraint("fecha_fin IS NULL OR fecha_fin > fecha_inicio", name="ck_presupuestos_fechas"),
        sa.CheckConstraint(
            "(periodo = 'personalizado' AND fecha_inicio IS NOT NULL) OR periodo != 'personalizado'",
            name="ck_presupuestos_personalizado"
        ),
    )

    op.create_table(
        "metas_ahorro",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(100), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("monto_objetivo", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("monto_actual", sa.DECIMAL(15, 2), nullable=False, server_default="0.00"),
        sa.Column("fecha_objetivo", sa.Date, nullable=True),
        sa.Column("tipo", sa.Enum(name="meta_tipo", create_type=False), nullable=False),
        sa.Column("cuenta_id", UUID(as_uuid=True), nullable=True),
        sa.Column("color", sa.VARCHAR(7), nullable=False, server_default="#10b981"),
        sa.Column("icono", sa.VARCHAR(50), nullable=True),
        sa.Column("prioridad", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("completada", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("fecha_completada", sa.Date, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_metas_usuario", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"], name="fk_metas_cuenta", ondelete="SET NULL"),
        sa.CheckConstraint("monto_objetivo > 0", name="ck_metas_objetivo"),
        sa.CheckConstraint("monto_actual >= 0", name="ck_metas_actual_positivo"),
        sa.CheckConstraint("monto_actual <= monto_objetivo OR completada = TRUE", name="ck_metas_actual_limite"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # PATRIMONIO
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "activos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(150), nullable=False),
        sa.Column("tipo", sa.Enum(name="activo_tipo", create_type=False), nullable=False),
        sa.Column("valor_compra", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("fecha_compra", sa.Date, nullable=False),
        sa.Column("valor_actual", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("metodo_valoracion", sa.VARCHAR(10), nullable=False, server_default="manual"),
        sa.Column("tasa_depreciacion_anual", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("ultima_valoracion", sa.Date, nullable=False),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_activos_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("valor_compra > 0", name="ck_activos_valor_compra"),
        sa.CheckConstraint("valor_actual >= 0", name="ck_activos_valor_actual"),
        sa.CheckConstraint("tasa_depreciacion_anual BETWEEN 0 AND 100", name="ck_activos_depreciacion"),
        sa.CheckConstraint("metodo_valoracion IN ('automatico', 'manual')", name="ck_activos_metodo"),
    )

    op.create_table(
        "pasivos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.VARCHAR(150), nullable=False),
        sa.Column("tipo", sa.Enum(name="pasivo_tipo", create_type=False), nullable=False),
        sa.Column("monto_original", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("saldo_pendiente", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("tasa_interes_anual", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("fecha_inicio", sa.Date, nullable=False),
        sa.Column("fecha_fin", sa.Date, nullable=True),
        sa.Column("cuota_mensual", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("acreedor", sa.VARCHAR(150), nullable=True),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_pasivos_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("monto_original > 0", name="ck_pasivos_monto_original"),
        sa.CheckConstraint("saldo_pendiente >= 0", name="ck_pasivos_saldo_pendiente"),
        sa.CheckConstraint("saldo_pendiente <= monto_original", name="ck_pasivos_saldo_limite"),
    )

    op.create_table(
        "equifax_reportes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("equifax_transaction_id", sa.VARCHAR(100), nullable=False),
        sa.Column("fecha_consulta", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("score_principal", sa.SmallInteger, nullable=True),
        sa.Column("score_inclusion", sa.SmallInteger, nullable=True),
        sa.Column("score_sobreendeudamiento", sa.SmallInteger, nullable=True),
        sa.Column("segmentacion_riesgo", sa.VARCHAR(20), nullable=True),
        sa.Column("segmentacion_cliente", sa.VARCHAR(5), nullable=True),
        sa.Column("modelo_utilizado", sa.VARCHAR(50), nullable=True),
        sa.Column("capacidad_pago", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("gasto_financiero", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("income_predictor", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("cupo_sugerido", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("nivel_ingresos", sa.VARCHAR(20), nullable=True),
        sa.Column("inhabilitado", sa.Boolean, nullable=True),
        sa.Column("total_deuda_sb", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("total_deuda_seps", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("total_deuda_sicom", sa.DECIMAL(15, 2), nullable=True),
        sa.Column("historico_score", JSONB, nullable=True),
        sa.Column("historico_endeudamiento", JSONB, nullable=True),
        sa.Column("raw_json", JSONB, nullable=False),
        sa.Column("archivo_path", sa.VARCHAR(500), nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_equifax_usuario", ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", "equifax_transaction_id", name="uq_equifax_transaction"),
    )

    op.create_table(
        "cripto_precios_historico",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("simbolo", sa.VARCHAR(20), nullable=False),
        sa.Column("coingecko_id", sa.VARCHAR(100), nullable=False),
        sa.Column("precio_usd", sa.DECIMAL(20, 8), nullable=False),
        sa.Column("registrado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # COBROS Y DEUDAS
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "cuentas_por_cobrar",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("deudor_nombre", sa.VARCHAR(150), nullable=False),
        sa.Column("deudor_email", sa.VARCHAR(255), nullable=True),
        sa.Column("deudor_telegram", sa.VARCHAR(100), nullable=True),
        sa.Column("deudor_telefono", sa.VARCHAR(20), nullable=True),
        sa.Column("monto_original", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("monto_pagado", sa.DECIMAL(15, 2), nullable=False, server_default="0.00"),
        sa.Column("fecha_prestamo", sa.Date, nullable=False),
        sa.Column("fecha_prometida", sa.Date, nullable=True),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("estado", sa.Enum(name="cobrar_estado", create_type=False), nullable=False, server_default="pendiente"),
        sa.Column("ultimo_recordatorio", TIMESTAMPTZ, nullable=True),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_cobrar_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("monto_original > 0", name="ck_cobrar_monto_original"),
        sa.CheckConstraint("monto_pagado >= 0", name="ck_cobrar_monto_pagado"),
        sa.CheckConstraint("monto_pagado <= monto_original", name="ck_cobrar_monto_limite"),
    )

    op.create_table(
        "cuentas_por_cobrar_abonos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cuenta_cobrar_id", UUID(as_uuid=True), nullable=False),
        sa.Column("monto", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["cuenta_cobrar_id"], ["cuentas_por_cobrar.id"], name="fk_cobrar_abonos", ondelete="CASCADE"),
        sa.CheckConstraint("monto > 0", name="ck_cobrar_abonos_monto"),
    )

    op.create_table(
        "deudas_informales",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("acreedor_nombre", sa.VARCHAR(150), nullable=False),
        sa.Column("monto_original", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("monto_pagado", sa.DECIMAL(15, 2), nullable=False, server_default="0.00"),
        sa.Column("fecha_deuda", sa.Date, nullable=False),
        sa.Column("fecha_prometida", sa.Date, nullable=True),
        sa.Column("descripcion", sa.Text, nullable=True),
        sa.Column("estado", sa.Enum(name="deuda_informal_estado", create_type=False), nullable=False, server_default="pendiente"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_deudas_informales_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("monto_original > 0", name="ck_deudas_monto_original"),
        sa.CheckConstraint("monto_pagado >= 0", name="ck_deudas_monto_pagado"),
        sa.CheckConstraint("monto_pagado <= monto_original", name="ck_deudas_monto_limite"),
    )

    op.create_table(
        "deudas_informales_abonos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("deuda_id", UUID(as_uuid=True), nullable=False),
        sa.Column("monto", sa.DECIMAL(15, 2), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["deuda_id"], ["deudas_informales.id"], name="fk_deudas_abonos", ondelete="CASCADE"),
        sa.CheckConstraint("monto > 0", name="ck_deudas_abonos_monto"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # SISTEMA
    # ══════════════════════════════════════════════════════════════════════════

    op.create_table(
        "adjuntos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("transaccion_id", UUID(as_uuid=True), nullable=True),
        sa.Column("nombre_original", sa.VARCHAR(255), nullable=False),
        sa.Column("nombre_storage", sa.VARCHAR(255), nullable=False),
        sa.Column("ruta", sa.VARCHAR(500), nullable=False),
        sa.Column("tipo_mime", sa.VARCHAR(100), nullable=False),
        sa.Column("tamano_bytes", sa.Integer, nullable=False),
        sa.Column("subido_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_adjuntos_usuario", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaccion_id"], ["transacciones.id"], name="fk_adjuntos_transaccion", ondelete="SET NULL"),
        sa.CheckConstraint("tamano_bytes > 0", name="ck_adjuntos_tamano_positivo"),
        sa.CheckConstraint("tamano_bytes <= 10485760", name="ck_adjuntos_tamano_max"),
    )

    op.create_table(
        "notificaciones_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("evento", sa.Enum(name="notif_evento", create_type=False), nullable=False),
        sa.Column("canal", sa.VARCHAR(10), nullable=False),
        sa.Column("estado", sa.VARCHAR(10), nullable=False),
        sa.Column("titulo", sa.VARCHAR(255), nullable=True),
        sa.Column("mensaje", sa.Text, nullable=True),
        sa.Column("error_mensaje", sa.Text, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("creado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], name="fk_notif_log_usuario", ondelete="CASCADE"),
        sa.CheckConstraint("canal IN ('email', 'telegram', 'push')", name="ck_notif_log_canal"),
        sa.CheckConstraint("estado IN ('enviado', 'fallido', 'pendiente')", name="ck_notif_log_estado"),
    )

    op.create_table(
        "backup_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tipo", sa.VARCHAR(20), nullable=False),
        sa.Column("estado", sa.VARCHAR(15), nullable=False),
        sa.Column("archivo_nombre", sa.VARCHAR(255), nullable=True),
        sa.Column("tamano_bytes", sa.BigInteger, nullable=True),
        sa.Column("gdrive_file_id", sa.VARCHAR(255), nullable=True),
        sa.Column("gdrive_url", sa.VARCHAR(500), nullable=True),
        sa.Column("error_mensaje", sa.Text, nullable=True),
        sa.Column("iniciado_en", TIMESTAMPTZ, nullable=False, server_default=sa.text("NOW()")),
        sa.Column("completado_en", TIMESTAMPTZ, nullable=True),
        sa.CheckConstraint("tipo IN ('db_dump', 'data_export', 'adjuntos_sync')", name="ck_backup_tipo"),
        sa.CheckConstraint("estado IN ('exitoso', 'fallido', 'en_progreso')", name="ck_backup_estado"),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # ÍNDICES
    # ══════════════════════════════════════════════════════════════════════════

    # Core
    op.create_index("idx_refresh_tokens_hash", "refresh_tokens", ["token_hash"])
    op.create_index("idx_refresh_tokens_usuario", "refresh_tokens", ["usuario_id"])

    # Cuentas
    op.create_index("idx_cuentas_usuario", "cuentas", ["usuario_id", "activa"])
    op.create_index("idx_ahorro_virtual_padre", "ahorro_virtual_config", ["cuenta_padre_id"])

    # Categorias
    op.create_index("idx_categorias_usuario", "categorias", ["usuario_id", "activa"])
    op.create_index(
        "idx_categorias_parent", "categorias", ["parent_id"],
        postgresql_where=sa.text("parent_id IS NOT NULL")
    )

    # Transacciones
    op.create_index("idx_txn_usuario_fecha", "transacciones", ["usuario_id", sa.text("fecha DESC")])
    op.create_index("idx_txn_usuario_cuenta", "transacciones", ["usuario_id", "cuenta_id"])
    op.create_index("idx_txn_usuario_categoria", "transacciones", ["usuario_id", "categoria_id"])
    op.create_index(
        "idx_txn_estado", "transacciones", ["usuario_id", "estado"],
        postgresql_where=sa.text("estado != 'completada'")
    )
    op.create_index(
        "idx_txn_recurrente", "transacciones", ["recurrente_id"],
        postgresql_where=sa.text("recurrente_id IS NOT NULL")
    )
    op.create_index(
        "idx_recurrentes_proxima", "transacciones_recurrentes", ["proxima_ejecucion", "activa"],
        postgresql_where=sa.text("activa = TRUE")
    )
    op.create_index("idx_etiquetas_usuario", "etiquetas", ["usuario_id"])

    # Presupuestos y Metas
    op.create_index("idx_presupuestos_usuario", "presupuestos", ["usuario_id", "activo"])
    op.create_index("idx_presupuestos_categoria", "presupuestos", ["usuario_id", "categoria_id"])
    op.create_index(
        "idx_presupuestos_unique", "presupuestos", ["usuario_id", "categoria_id", "periodo"],
        unique=True,
        postgresql_where=sa.text("activo = TRUE AND periodo != 'personalizado'")
    )
    op.create_index("idx_metas_usuario", "metas_ahorro", ["usuario_id", "activa", "completada"])

    # Patrimonio
    op.create_index("idx_activos_usuario", "activos", ["usuario_id", "activo"])
    op.create_index("idx_pasivos_usuario", "pasivos", ["usuario_id", "activo"])
    op.create_index("idx_equifax_usuario_fecha", "equifax_reportes", ["usuario_id", sa.text("fecha_consulta DESC")])
    op.create_index("idx_cripto_hist_simbolo", "cripto_precios_historico", ["simbolo", sa.text("registrado_en DESC")])

    # Cobros y Deudas
    op.create_index("idx_cobrar_usuario_estado", "cuentas_por_cobrar", ["usuario_id", "estado"])
    op.create_index(
        "idx_cobrar_fecha_prometida", "cuentas_por_cobrar", ["usuario_id", "fecha_prometida"],
        postgresql_where=sa.text("estado IN ('pendiente', 'parcial')")
    )
    op.create_index("idx_deudas_usuario_estado", "deudas_informales", ["usuario_id", "estado"])

    # Sistema
    op.create_index(
        "idx_adjuntos_transaccion", "adjuntos", ["transaccion_id"],
        postgresql_where=sa.text("transaccion_id IS NOT NULL")
    )
    op.create_index("idx_adjuntos_usuario", "adjuntos", ["usuario_id"])
    op.create_index("idx_notif_log_usuario", "notificaciones_log", ["usuario_id", sa.text("creado_en DESC")])
    op.create_index("idx_backup_log_tipo", "backup_log", ["tipo", sa.text("iniciado_en DESC")])


def downgrade() -> None:

    # Índices
    op.drop_index("idx_backup_log_tipo", table_name="backup_log")
    op.drop_index("idx_notif_log_usuario", table_name="notificaciones_log")
    op.drop_index("idx_adjuntos_usuario", table_name="adjuntos")
    op.drop_index("idx_adjuntos_transaccion", table_name="adjuntos")
    op.drop_index("idx_deudas_usuario_estado", table_name="deudas_informales")
    op.drop_index("idx_cobrar_fecha_prometida", table_name="cuentas_por_cobrar")
    op.drop_index("idx_cobrar_usuario_estado", table_name="cuentas_por_cobrar")
    op.drop_index("idx_cripto_hist_simbolo", table_name="cripto_precios_historico")
    op.drop_index("idx_equifax_usuario_fecha", table_name="equifax_reportes")
    op.drop_index("idx_pasivos_usuario", table_name="pasivos")
    op.drop_index("idx_activos_usuario", table_name="activos")
    op.drop_index("idx_metas_usuario", table_name="metas_ahorro")
    op.drop_index("idx_presupuestos_unique", table_name="presupuestos")
    op.drop_index("idx_presupuestos_categoria", table_name="presupuestos")
    op.drop_index("idx_presupuestos_usuario", table_name="presupuestos")
    op.drop_index("idx_etiquetas_usuario", table_name="etiquetas")
    op.drop_index("idx_recurrentes_proxima", table_name="transacciones_recurrentes")
    op.drop_index("idx_txn_recurrente", table_name="transacciones")
    op.drop_index("idx_txn_estado", table_name="transacciones")
    op.drop_index("idx_txn_usuario_categoria", table_name="transacciones")
    op.drop_index("idx_txn_usuario_cuenta", table_name="transacciones")
    op.drop_index("idx_txn_usuario_fecha", table_name="transacciones")
    op.drop_index("idx_categorias_parent", table_name="categorias")
    op.drop_index("idx_categorias_usuario", table_name="categorias")
    op.drop_index("idx_ahorro_virtual_padre", table_name="ahorro_virtual_config")
    op.drop_index("idx_cuentas_usuario", table_name="cuentas")
    op.drop_index("idx_refresh_tokens_usuario", table_name="refresh_tokens")
    op.drop_index("idx_refresh_tokens_hash", table_name="refresh_tokens")

    # Tablas — orden inverso de dependencias
    op.drop_table("backup_log")
    op.drop_table("notificaciones_log")
    op.drop_table("adjuntos")
    op.drop_table("deudas_informales_abonos")
    op.drop_table("deudas_informales")
    op.drop_table("cuentas_por_cobrar_abonos")
    op.drop_table("cuentas_por_cobrar")
    op.drop_table("cripto_precios_historico")
    op.drop_table("equifax_reportes")
    op.drop_table("pasivos")
    op.drop_table("activos")
    op.drop_table("metas_ahorro")
    op.drop_table("presupuestos")
    op.drop_table("transacciones_etiquetas")
    op.drop_table("transacciones")
    op.drop_table("transacciones_recurrentes")
    op.drop_table("etiquetas")
    op.drop_table("ahorro_virtual_config")
    op.drop_table("cripto_config")
    op.drop_table("tarjetas_config")
    op.drop_table("cuentas")
    op.drop_table("cupos_grupos")
    # FK autorreferencial antes de drop
    op.drop_constraint("fk_categorias_parent", "categorias", type_="foreignkey")
    op.drop_table("categorias")
    op.drop_table("refresh_tokens")
    op.drop_table("notification_preferences")
    op.drop_table("user_settings")
    op.drop_table("usuarios")

    # Enums — al final
    op.execute("DROP TYPE IF EXISTS deuda_informal_estado")
    op.execute("DROP TYPE IF EXISTS cobrar_estado")
    op.execute("DROP TYPE IF EXISTS pasivo_tipo")
    op.execute("DROP TYPE IF EXISTS activo_tipo")
    op.execute("DROP TYPE IF EXISTS meta_tipo")
    op.execute("DROP TYPE IF EXISTS presupuesto_periodo")
    op.execute("DROP TYPE IF EXISTS recurrente_freq")
    op.execute("DROP TYPE IF EXISTS txn_estado")
    op.execute("DROP TYPE IF EXISTS txn_canal")
    op.execute("DROP TYPE IF EXISTS txn_tipo")
    op.execute("DROP TYPE IF EXISTS cuenta_tipo")
    op.execute("DROP TYPE IF EXISTS notif_evento")
