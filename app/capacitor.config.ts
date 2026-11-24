import type { CapacitorConfig } from '@capacitor/cli';

/**
 * [M8] Identidad de la app: carné C34807 · primer apellido Mendez.
 * Como android/ ya existía, el mismo appId/appName se cambió a mano en:
 *   android/app/build.gradle  (namespace y applicationId)
 *   android/app/src/main/res/values/strings.xml  (app_name, title_activity_main, package_name, custom_url_scheme)
 *   android/app/src/main/java/cr/ac/ucr/if0009/c34807/MainActivity.java  (carpeta y package movidos)
 */
const config: CapacitorConfig = {
  appId: 'cr.ac.ucr.if0009.c34807',
  appName: 'Préstamos Mendez',
  webDir: 'dist',
  android: {
    // Solo para el examen: la API local corre en http://10.0.2.2.
    // La excepción de texto en claro está acotada en res/xml/network_security_config.xml
    allowMixedContent: true,
  },
};

export default config;
