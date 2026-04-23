CREATE TABLE IF NOT EXISTS procesos_mipres (
  id_local                 INTEGER PRIMARY KEY AUTOINCREMENT,
  id_mipres                TEXT DEFAULT NULL,
  id_programacion          TEXT DEFAULT NULL,
  id_entrega               TEXT DEFAULT NULL,
  id_reporte               TEXT DEFAULT NULL,
  cod_ser_tec_a_entregar   TEXT DEFAULT NULL,
  cant_tot_a_entregar      INTEGER DEFAULT NULL,
  fec_max_ent              TEXT DEFAULT NULL,
  disponibles              TEXT DEFAULT NULL,
  estado                   TEXT NOT NULL DEFAULT 'INICIADO',
  token                    TEXT DEFAULT NULL,
  nit                      TEXT DEFAULT NULL,
  no_prescripcion          TEXT DEFAULT NULL,
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estado ON procesos_mipres(estado);
CREATE INDEX IF NOT EXISTS idx_nit ON procesos_mipres(nit);
CREATE INDEX IF NOT EXISTS idx_id_mipres ON procesos_mipres(id_mipres);
