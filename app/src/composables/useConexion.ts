import { onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Network, type ConnectionStatus } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * [M7] useConexion() devuelve { conectado, tipo } y los mantiene al día.
 *   - Valor inicial con Network.getStatus().
 *   - Cambios con el oyente 'networkStatusChange'.
 *   - El oyente se libera (handle.remove()) cuando se destruye la página que lo usa.
 * Las páginas Equipos y Formulario muestran el aviso "Sin conexión" y deshabilitan Guardar con `conectado`.
 */
export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  const actualizar = (estado: ConnectionStatus) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  };

  // addListener devuelve una PROMESA del handle: se guarda la promesa para poder liberarlo
  // aunque la página se destruya antes de que termine de registrarse.
  const oyente = Network.addListener('networkStatusChange', actualizar);
  Network.getStatus().then(actualizar);

  onUnmounted(async () => {
    const handle = await oyente;
    await handle.remove();
  });

  return { conectado, tipo };
}

/**
 * [M7] Vibración breve de confirmación. En el navegador no hace nada (no es plataforma nativa).
 * Un fallo al vibrar no debe convertir un guardado exitoso en un error: se ignora.
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // La vibración es solo una ayuda: si el dispositivo no la soporta, se sigue sin ella.
  }
}
