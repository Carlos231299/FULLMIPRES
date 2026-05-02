import * as xlsx from 'xlsx';

/**
 * Exporta el resultado de un proceso individual a Excel y lo descarga en el navegador.
 */
export const exportProcessToExcel = async (proceso: any): Promise<string> => {
  try {
    const data = [{
      'ID_Local': proceso.id_local,
      'NIT': proceso.nit,
      'No_MIPRES': proceso.no_prescripcion,
      'Tecnología': proceso.cod_ser_tec_a_entregar,
      'Cantidad': proceso.cant_tot_a_entregar,
      'Fec_Max_Ent': proceso.fec_max_ent,
      'ID_Direccionamiento': proceso.id_direccionamiento || proceso.id_mipres,
      'ID_Programacion': proceso.id_programacion,
      'ID_Entrega': proceso.id_entrega,
      'ID_Reporte': proceso.id_reporte,
      'Resultado_App': proceso.estado === 'REPORTADO' ? '✅ Proceso Completado con Éxito' : '⚠️ En Proceso',
      'RESPUESTA_CRUDA_SISPRO': proceso.log || 'N/A',
      'Fecha_Proceso': new Date().toLocaleString()
    }];

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Reporte Individual');

    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const now = new Date();
    const hours24 = now.getHours();
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const timePart = `${hours12}-${minutes}${ampm}`;
    const fileName = `ResultadoMIPRES(${proceso.no_prescripcion})_${datePart}_${timePart}.xlsx`;

    // Descarga estándar del navegador
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);

    return fileName;
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    throw error;
  }
};
