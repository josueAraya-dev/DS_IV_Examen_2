import { computed, ref } from 'vue';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Device } from '@capacitor/device';
import { api } from '@/services/api';

export interface Usuario { id: number; nombre: string }

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

// Estado compartido por toda la app (fuera de la función = un solo valor) — YA IMPLEMENTADO
const token = ref<string | null>(null);
const usuario = ref<Usuario | null>(null);
let tokenCargado = false;

/** YA IMPLEMENTADO — lo usa services/api.ts para armar el encabezado Authorization. */
export const obtenerToken = () => token.value;

/**
 * [M2] Sesión segura.
 *
 * El token y el usuario se guardan con SecureStorage (@aparajita/capacitor-secure-storage):
 * Keystore en Android, Keychain en iOS.  NO se usa localStorage ni @capacitor/preferences.
 */

const MAX_DEVICE_NAME = 60;

interface RespuestaLogin { token: string; usuario: Usuario }

/** [M2] Borra token y usuario de la memoria (refs) y del almacenamiento cifrado. */
export async function olvidarSesion() {
  token.value = null;
  usuario.value = null;
  await Promise.all([SecureStorage.remove(CLAVE_TOKEN), SecureStorage.remove(CLAVE_USUARIO)]);
}

/** Identifica el dispositivo en el token de Sanctum, ej. "android sdk_gphone64_x86_64". */
async function nombreDispositivo(): Promise<string> {
  const { platform, model } = await Device.getInfo();
  return `${platform} ${model}`.slice(0, MAX_DEVICE_NAME);
}

export function useAuth() {
  const estaAutenticado = computed(() => token.value !== null);

  /**
   * [M2] login(email, password)
   *  El error NO se atrapa aquí: api() lanza ErrorApi y LoginPage.vue muestra los 422 / 429.
   */
  async function login(email: string, password: string) {
    const device_name = await nombreDispositivo();
    const respuesta = await api<RespuestaLogin>('/login', {
      method: 'POST',
      body: { email, password, device_name },
    });

    token.value = respuesta.token;
    usuario.value = respuesta.usuario;
    await Promise.all([
      SecureStorage.set(CLAVE_TOKEN, respuesta.token),
      SecureStorage.set(CLAVE_USUARIO, { ...respuesta.usuario }),
    ]);
  }

  /**
   * [M2] cargarToken()
   *  Al abrir la app recupera token y usuario de SecureStorage y los pone en los refs.
   *  La bandera tokenCargado hace que solo lea el almacenamiento la primera vez
   *  (la guarda del router lo llama antes de CADA navegación).
   */
  async function cargarToken() {
    if (tokenCargado) return;

    try {
      const [tokenGuardado, usuarioGuardado] = await Promise.all([
        SecureStorage.get(CLAVE_TOKEN),
        SecureStorage.get(CLAVE_USUARIO),
      ]);
      token.value = typeof tokenGuardado === 'string' ? tokenGuardado : null;
      usuario.value = (usuarioGuardado as Usuario | null) ?? null;
    } catch {
      // Datos cifrados corruptos o ilegibles: se empieza sin sesión.
      await olvidarSesion();
    } finally {
      tokenCargado = true;
    }
  }

  /**
   * [M2] cerrarSesion()
   *  POST /logout revoca el token en el servidor. El finally garantiza que la sesión
   *  local se borre SIEMPRE, aunque la API falle (sin red o token vencido).
   */
  async function cerrarSesion() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
    } finally {
      await olvidarSesion();
    }
  }

  return { usuario, estaAutenticado, login, cargarToken, cerrarSesion };
}
