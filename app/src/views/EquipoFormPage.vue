<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/equipos" text="" />
        </ion-buttons>
        <ion-title>{{ id ? 'Editar equipo' : 'Nuevo equipo' }}</ion-title>
      </ion-toolbar>
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: no es posible guardar</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="guardar" novalidate>
        <ion-list lines="full">
          <ion-item>
            <ion-input v-model="datos.codigo" label="Código" label-placement="stacked" placeholder="EQ-0000"
              autocapitalize="characters" :maxlength="20" />
          </ion-item>
          <small v-if="errores.codigo" class="error-campo">{{ errores.codigo }}</small>

          <ion-item>
            <ion-input v-model="datos.nombre" label="Nombre" label-placement="stacked" :maxlength="120" />
          </ion-item>
          <small v-if="errores.nombre" class="error-campo">{{ errores.nombre }}</small>

          <ion-item>
            <ion-select v-model="datos.categoria_id" label="Categoría" label-placement="stacked"
              interface="action-sheet" placeholder="Seleccione" cancel-text="Cancelar">
              <ion-select-option v-for="c in listaCategorias" :key="c.id" :value="c.id">{{ c.nombre }}</ion-select-option>
            </ion-select>
          </ion-item>
          <small v-if="errores.categoria_id" class="error-campo">{{ errores.categoria_id }}</small>

          <ion-item v-if="estadoActual !== 'prestado'">
            <ion-select v-model="datos.estado" label="Estado" label-placement="stacked" interface="popover">
              <ion-select-option value="disponible">Disponible</ion-select-option>
              <ion-select-option value="mantenimiento">Mantenimiento</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item v-else>
            <ion-label>Estado: prestado (no se modifica desde aquí)</ion-label>
          </ion-item>
          <small v-if="errores.estado" class="error-campo">{{ errores.estado }}</small>

          <ion-item>
            <ion-input v-model="datos.fecha_adquisicion" label="Fecha de adquisición" label-placement="stacked"
              type="date" :max="hoy" />
          </ion-item>
          <small v-if="errores.fecha_adquisicion" class="error-campo">{{ errores.fecha_adquisicion }}</small>

          <ion-item>
            <ion-input v-model="datos.costo_interno" label="Costo interno (₡)" label-placement="stacked"
              type="number" inputmode="decimal" :min="0"
              :helper-text="id ? 'La API no expone este dato: vuelva a ingresarlo.' : undefined" />
          </ion-item>
          <small v-if="errores.costo_interno" class="error-campo">{{ errores.costo_interno }}</small>
        </ion-list>

        <ion-button type="submit" expand="block" class="ion-margin-top" :disabled="!conectado">
          Guardar
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonList, IonItem,
  IonInput, IonSelect, IonSelectOption, IonLabel, IonButton,
  loadingController, onIonViewWillEnter, useIonRouter,
} from '@ionic/vue';
import { actualizar, categorias, crear, obtener, type Categoria, type DatosEquipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

// id llega por props: true en la ruta equipos/:id/editar; en equipos/nuevo es undefined
const props = defineProps<{ id?: string }>();
const id = props.id;

const ionRouter = useIonRouter();
const { conectado } = useConexion();
const hoy = new Date().toISOString().slice(0, 10);

const vacio = (): DatosEquipo => ({
  codigo: '', nombre: '', categoria_id: null, estado: 'disponible', fecha_adquisicion: hoy, costo_interno: null,
});

const datos = reactive<DatosEquipo>(vacio());
const listaCategorias = ref<Categoria[]>([]);
const estadoActual = ref<Estado>('disponible');
const errores = ref<Record<string, string>>({});

const HTTP_NO_ENCONTRADO = 404;
const HTTP_NO_PROCESABLE = 422;

/** Vuelve a la lista: back() si hay historial (animación de regreso); si no, la reemplaza. */
function volverALista() {
  if (ionRouter.canGoBack()) ionRouter.back();
  else ionRouter.navigate('/tabs/equipos', 'back', 'replace');
}

/**
 * [M5] Al entrar a la página: categorías y, en edición, el equipo, en paralelo (Promise.all).
 *  costo_interno queda en null: la API no lo devuelve (EquipoResource lo oculta).
 */
onIonViewWillEnter(async () => {
  errores.value = {};
  try {
    const [lista, equipo] = await Promise.all([categorias(), id ? obtener(id) : null]);
    listaCategorias.value = lista;

    if (!equipo) {
      Object.assign(datos, vacio());
      estadoActual.value = 'disponible';
      return;
    }

    Object.assign(datos, {
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      categoria_id: equipo.categoria.id,
      // Un equipo prestado no muestra el select de estado (ver template) ni lo envía.
      estado: equipo.estado === 'prestado' ? undefined : equipo.estado,
      fecha_adquisicion: equipo.fecha_adquisicion,
      costo_interno: null,
    });
    estadoActual.value = equipo.estado;
  } catch (e) {
    if (e instanceof ErrorApi && e.status === HTTP_NO_ENCONTRADO) {
      mostrarToast('El equipo ya no existe.', 'warning');
      volverALista();
    } else {
      mostrarToast('No fue posible cargar el formulario.', 'danger');
    }
  }
});

/**
 * Cuerpo que se envía: código en mayúscula y sin espacios sobrantes, costo_interno como número
 * (ion-input type="number" entrega un string) y SIN estado si el equipo está prestado.
 */
function construirCuerpo(): DatosEquipo {
  const costo = String(datos.costo_interno ?? '').trim();
  const cuerpo: DatosEquipo = {
    codigo: datos.codigo.trim().toUpperCase(),
    nombre: datos.nombre.trim(),
    categoria_id: datos.categoria_id,
    fecha_adquisicion: datos.fecha_adquisicion,
    costo_interno: costo === '' ? null : Number(costo),
  };
  if (estadoActual.value !== 'prestado') cuerpo.estado = datos.estado;
  return cuerpo;
}

/** [M5] Crea o actualiza; el loading se cierra en el finally, salga bien o mal. */
async function guardar() {
  errores.value = {};
  const cargando = await loadingController.create({ message: 'Guardando…' });
  await cargando.present();

  try {
    const cuerpo = construirCuerpo();
    if (id) await actualizar(id, cuerpo);
    else await crear(cuerpo);

    await vibrar();
    mostrarToast(id ? 'Equipo actualizado.' : 'Equipo creado.', 'success');
    volverALista();
  } catch (e) {
    if (e instanceof ErrorApi && e.status === HTTP_NO_PROCESABLE) {
      // Primer mensaje de cada campo; el template los pinta debajo de su campo.
      errores.value = e.erroresPorCampo;
    } else if (e instanceof ErrorApi && e.status === HTTP_NO_ENCONTRADO) {
      mostrarToast('El equipo ya no existe.', 'warning');
      volverALista();
    } else {
      mostrarToast('No fue posible guardar el equipo.', 'danger');
    }
  } finally {
    await cargando.dismiss();
  }
}
</script>
