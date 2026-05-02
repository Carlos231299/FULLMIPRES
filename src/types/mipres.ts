// Tipos del dominio MIPRES

export interface Proceso {
  id_local:               number;
  id_mipres:              string | null;
  id_direccionamiento?:   string | null;
  id_programacion:        string | null;
  id_entrega:             string | null;
  id_reporte:             string | null;
  cod_ser_tec_a_entregar: string | null;
  cant_tot_a_entregar:    number | null;
  fec_max_ent?:           string;
  disponibles?:           any[];
  estado:                 EstadoProceso;
  token:                  string | null;
  nit:                    string | null;
  no_prescripcion:        string | null;
  created_at:             string;
  updated_at:             string;
}

export type EstadoProceso =
  | 'INICIADO'
  | 'VERIFICADO'
  | 'PROGRAMADO'
  | 'ENTREGADO'
  | 'REPORTADO';

// Mapa estado → número de paso completado
export const ESTADO_A_PASO: Record<EstadoProceso, number> = {
  INICIADO:      0,
  VERIFICADO:    1,
  PROGRAMADO:    2,
  ENTREGADO:     3,
  REPORTADO:     4,
};
