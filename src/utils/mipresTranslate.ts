export const MIPRES_MAP: Record<string, string> = {
  // Generales
  ID: 'ID Registro',
  IdDireccionamiento: 'ID Direccionamiento',
  IdProgramacion: 'ID Programación',
  IdEntrega: 'ID Entrega',
  IdReporteEntrega: 'ID Reporte Entrega',
  IdNOPresupuesto: 'ID No Direccionamiento',
  NoPrescripcion: 'N° Prescripción',
  TipoTec: 'Tipo Tecnología',
  ConTec: 'Consecutivo Tecnología',
  TipoIDPaciente: 'Tipo ID Paciente',
  NoIDPaciente: 'N° ID Paciente',
  NoEntrega: 'N° Entrega',
  FecMaxEnt: 'Fecha Máxima Entrega',
  CantTotAEntregar: 'Cantidad Total',
  
  // Direccionamiento
  CodMunEnt: 'Código Municipio Entrega',
  DirPaciente: 'Dirección Paciente',
  FecDireccionamiento: 'Fecha Direccionamiento',
  EstDireccionamiento: 'Estado Direccionamiento',
  
  // Programación
  FecProgramacion: 'Fecha Programación',
  EstProgramacion: 'Estado Programación',
  TipoIDSedeProv: 'Tipo ID Sede Prov.',
  NoIDSedeProv: 'N° ID Sede Prov.',
  CodSedeProv: 'Código Sede Prov.',
  CodSerTecAEntregar: 'Código Tecnología',
  
  // Entrega
  FecEntrega: 'Fecha Entrega',
  EstEntrega: 'Estado Entrega',
  CodTecEntregado: 'Código Tec. Entregado',
  CantEntregada: 'Cantidad Entregada',
  EntTotal: 'Entrega Total',
  CausaNoEntrega: 'Causa No Entrega',
  
  // Reporte
  FecReporteEntrega: 'Fecha Reporte',
  EstReporteEntrega: 'Estado Reporte',
  ValorFacturado: 'Valor Facturado (COP)',
  NoFactura: 'N° Factura',
  
  // Otros
  FecAnulacion: 'Fecha Anulación',
  id_local: 'ID Proceso Local',
  estado: 'Estado Local',
  fec_creacion: 'Fecha Creación Local'
};

export const translateKey = (key: string): string => {
  return MIPRES_MAP[key] || key;
};
