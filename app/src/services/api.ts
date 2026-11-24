import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;
const HTTP_SIN_CONTENIDO = 204;
const HTTP_NO_AUTENTICADO = 401;
const RUTA_LOGIN = '/login';

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

/** Arma BASE_URL + ruta y agrega a la query string solo los params con valor (ni undefined ni ''). */
function construirUrl(ruta: string, params: OpcionesApi['params'] = {}): URL {
  const url = new URL(`${BASE_URL}${ruta}`);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === '') continue;
    url.searchParams.set(clave, String(valor));
  }
  return url;
}

/** Accept siempre; Authorization solo si hay token; Content-Type solo si hay cuerpo. */
function construirEncabezados(conCuerpo: boolean): Headers {
  const encabezados = new Headers({ Accept: 'application/json' });
  const token = obtenerToken();
  if (token) encabezados.set('Authorization', `Bearer ${token}`);
  if (conCuerpo) encabezados.set('Content-Type', 'application/json');
  return encabezados;
}

/** El cuerpo de un error puede no ser JSON (p. ej. una página HTML de error): en ese caso, null. */
async function leerCuerpo(respuesta: Response): Promise<any> {
  try {
    return await respuesta.json();
  } catch {
    return null;
  }
}

/**
 * [M1] Cliente HTTP único de la aplicación. Las vistas nunca usan fetch directamente:
 * pasan por services/equipos.ts, que a su vez llama a api().
 */
export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;
  const conCuerpo = body !== undefined;

  // Tiempo máximo: si la API no responde en 10 s, se aborta el fetch.
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, params), {
      method,
      headers: construirEncabezados(conCuerpo),
      body: conCuerpo ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch {
    // fetch solo falla cuando no hubo respuesta: sin red, tiempo agotado o CORS.
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  } finally {
    clearTimeout(temporizador);
  }

  if (respuesta.status === HTTP_SIN_CONTENIDO) return null as T;

  const cuerpo = await leerCuerpo(respuesta);

  if (!respuesta.ok) {
    // Token vencido o revocado: se borra la sesión local y se vuelve al login.
    // En /login un 401 no aplica (las credenciales malas son 422), así que no se redirige.
    if (respuesta.status === HTTP_NO_AUTENTICADO && ruta !== RUTA_LOGIN) {
      await olvidarSesion();
      await router.replace(RUTA_LOGIN);
    }
    throw new ErrorApi(respuesta.status, cuerpo);
  }

  return cuerpo as T;
}
