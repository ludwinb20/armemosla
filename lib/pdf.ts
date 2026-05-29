import { FacturaWithDetalles, FacturaMensual } from './pagos';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Genera un PDF de factura
 */
export async function generarFacturaPDF(
  factura: FacturaWithDetalles,
  nombreAdmin?: string
): Promise<string> {
  try {
    const fechaLimite = new Date(factura.fecha_limite_pago);
    const fechaCreacion = new Date(factura.created_at);
    const fechaPago = factura.fecha_pago ? new Date(factura.fecha_pago) : null;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #00C56E;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #00C56E;
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .invoice-info-left, .invoice-info-right {
            flex: 1;
          }
          .invoice-info-right {
            text-align: right;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-section h2 {
            color: #00C56E;
            font-size: 16px;
            margin-bottom: 10px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .info-value {
            color: #333;
          }
          .estado-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 12px;
          }
          .estado-pendiente {
            background-color: #fff3cd;
            color: #856404;
          }
          .estado-pagado {
            background-color: #d4edda;
            color: #155724;
          }
          .estado-vencido {
            background-color: #f8d7da;
            color: #721c24;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #00C56E;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .totals {
            margin-top: 30px;
            text-align: right;
          }
          .totals-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
          }
          .totals-label {
            font-weight: bold;
            margin-right: 20px;
            min-width: 150px;
            text-align: right;
          }
          .totals-value {
            min-width: 120px;
            text-align: right;
          }
          .total-final {
            font-size: 18px;
            font-weight: bold;
            color: #00C56E;
            border-top: 2px solid #00C56E;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Armemosla</h1>
          <p>Factura Mensual</p>
        </div>

        <div class="invoice-info">
          <div class="invoice-info-left">
            <div class="info-section">
              <h2>Información del Cliente</h2>
              <div class="info-row">
                <span class="info-label">Administrador:</span>
                <span class="info-value">${nombreAdmin || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">ID:</span>
                <span class="info-value">${factura.admin_id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
          <div class="invoice-info-right">
            <div class="info-section">
              <h2>Información de la Factura</h2>
              <div class="info-row">
                <span class="info-label">Período:</span>
                <span class="info-value">${MESES[factura.mes - 1]} ${factura.año}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Factura #:</span>
                <span class="info-value">${factura.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Fecha de emisión:</span>
                <span class="info-value">${fechaCreacion.toLocaleDateString('es-ES')}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Fecha límite:</span>
                <span class="info-value">${fechaLimite.toLocaleDateString('es-ES')}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="info-value">
                  <span class="estado-badge estado-${factura.estado_pago}">
                    ${factura.estado_pago.toUpperCase()}
                  </span>
                </span>
              </div>
              ${fechaPago ? `
              <div class="info-row">
                <span class="info-label">Fecha de pago:</span>
                <span class="info-value">${fechaPago.toLocaleDateString('es-ES')}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        ${factura.detalles && factura.detalles.length > 0 ? `
        <div class="info-section">
          <h2>Desglose por Cancha</h2>
          <table>
            <thead>
              <tr>
                <th>Cancha</th>
                <th>Complejo</th>
                <th>Reservas</th>
                <th>Total Facturado</th>
                <th>Comisión (10%)</th>
              </tr>
            </thead>
            <tbody>
              ${factura.detalles.map((detalle) => `
                <tr>
                  <td>${detalle.cancha?.nombre || 'N/A'}</td>
                  <td>${detalle.cancha?.complejo?.nombre || 'N/A'}</td>
                  <td>${detalle.total_reservas}</td>
                  <td>L ${detalle.total_facturado.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>L ${detalle.comision.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="totals">
          <div class="totals-row">
            <span class="totals-label">Total Facturado:</span>
            <span class="totals-value">L ${factura.total_facturado.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Comisión (10%):</span>
            <span class="totals-value">L ${factura.comision.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${(factura.total_descuentos_canje ?? 0) > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Descuentos por canjes:</span>
            <span class="totals-value" style="color: #155724">-L ${(factura.total_descuentos_canje ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ''}
          <div class="totals-row total-final">
            <span class="totals-label">Total a Pagar:</span>
            <span class="totals-value">L ${(factura.comision_neta ?? factura.comision).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div class="footer">
          <p>Esta es una factura generada automáticamente por el sistema Armemosla</p>
          <p>Para más información, contacte al soporte técnico</p>
        </div>
      </body>
      </html>
    `;

    // Importar expo-print dinámicamente
    let Print: typeof import('expo-print');
    try {
      Print = await import('expo-print');
    } catch (error) {
      throw new Error('La funcionalidad de exportación a PDF no está disponible. Por favor, ejecuta "npx expo prebuild" y luego "npx expo run:android" o "npx expo run:ios" para compilar el módulo nativo.');
    }

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error: any) {
    console.error('❌ [generarFacturaPDF] Error:', error);
    throw error;
  }
}

/**
 * Genera un PDF de factura y lo comparte
 */
export async function generarYCompartirFacturaPDF(
  factura: FacturaWithDetalles,
  nombreAdmin?: string
): Promise<void> {
  try {
    const uri = await generarFacturaPDF(factura, nombreAdmin);

    // Importar expo-sharing dinámicamente
    let Sharing: typeof import('expo-sharing');
    try {
      Sharing = await import('expo-sharing');
    } catch (error) {
      console.log('PDF generado en:', uri);
      throw new Error('Compartir no disponible. PDF generado en: ' + uri);
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      console.log('PDF generado en:', uri);
      throw new Error('Compartir no disponible. PDF generado en: ' + uri);
    }
  } catch (error: any) {
    console.error('❌ [generarYCompartirFacturaPDF] Error:', error);
    throw error;
  }
}
