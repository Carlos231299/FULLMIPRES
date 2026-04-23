export const getErrorMsg = (err: any): string => {
  if (!err) return 'Error desconocido';
  
  const data = err.response?.data;
  
  // Caso 1: Estructura de error de SISPRO encapsulada por nuestro backend
  // { ok: false, error: { Message: "...", Errors: [...] } }
  if (data?.error && typeof data.error === 'object') {
    const inner = data.error;
    if (Array.isArray(inner.Errors) && inner.Errors.length > 0) {
      return inner.Errors[0]; // Retornar el detalle real (ej: "No existe programación...")
    }
    if (inner.Message) return inner.Message;
  }
  
  // Caso 2: Mensaje directo en la raíz de data
  if (data?.Message) return data.Message;
  if (Array.isArray(data?.Errors) && data.Errors.length > 0) return data.Errors[0];

  if (data?.error && typeof data.error === 'string') {
    return data.error;
  }

  // Fallback a axios error messages o native error messages
  return err.message || 'Error inesperado del sistema';
};
