<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- [M4] Deslizar hacia abajo: vuelve a la página 1 -->
      <ion-refresher slot="fixed" @ion-refresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <!-- [M4] Primera carga: esqueleto con la misma forma que los ítems -->
      <ion-list v-if="primeraCarga" aria-busy="true">
        <ion-item v-for="n in ITEMS_ESQUELETO" :key="n">
          <ion-label>
            <h2><ion-skeleton-text :animated="true" class="esqueleto-titulo" /></h2>
            <p><ion-skeleton-text :animated="true" class="esqueleto-detalle" /></p>
          </ion-label>
          <ion-skeleton-text slot="end" :animated="true" class="esqueleto-badge" />
        </ion-item>
      </ion-list>

      <!-- [M4] Error sin datos que mostrar -->
      <div v-else-if="error && equipos.length === 0" class="estado-vacio" role="alert">
        <ion-icon :icon="cloudOfflineOutline" aria-hidden="true" />
        <p>{{ error }}</p>
        <ion-button fill="outline" @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- [M4] Estado vacío -->
      <div v-else-if="equipos.length === 0" class="estado-vacio">
        <ion-icon :icon="searchOutline" aria-hidden="true" />
        <p>{{ q ? `No hay equipos que coincidan con «${q}».` : 'Todavía no hay equipos registrados.' }}</p>
      </div>

      <!-- [M4] Listado -->
      <ion-list v-else>
        <ion-item v-for="equipo in equipos" :key="equipo.id" :router-link="`/tabs/equipos/${equipo.id}/editar`" detail>
          <ion-label>
            <h2>{{ equipo.nombre }}</h2>
            <p>{{ equipo.codigo }} · {{ equipo.categoria.nombre }}</p>
          </ion-label>
          <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
        </ion-item>
      </ion-list>

      <!-- [M4] Siguiente página; se apaga cuando meta.current_page === meta.last_page -->
      <ion-infinite-scroll :disabled="!hayMas" @ion-infinite="cargarMas">
        <ion-infinite-scroll-content loading-text="Cargando más equipos…" />
      </ion-infinite-scroll>

      <!--
        TODO [M6] Eliminación (8 pts)
          - Envuelva cada ion-item en ion-item-sliding con un ion-item-option "Eliminar" (color danger).
      -->
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

// Importaciones que usará la eliminación [M6]
void [IonItemSliding, IonItemOptions, IonItemOption, trashOutline];

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };
const ITEMS_ESQUELETO = 6;

const { conectado } = useConexion();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);
// El esqueleto solo se muestra mientras no hay nada que enseñar (no en cada recarga).
const primeraCarga = computed(() => cargando.value && equipos.value.length === 0);

/**
 * [M4] cargar(reiniciar)
 *  - reiniciar = true  → pide la página 1 y REEMPLAZA la lista.
 *  - reiniciar = false → pide la página siguiente y la AGREGA al final.
 *  Un 401 ya lo resuelve api.ts (borra la sesión y va a /login).
 */
async function cargar(reiniciar = false) {
  const siguiente = reiniciar ? 1 : pagina.value + 1;
  cargando.value = true;
  error.value = '';

  try {
    const { data, meta } = await listar(siguiente, q.value);
    equipos.value = reiniciar ? data : [...equipos.value, ...data];
    pagina.value = meta.current_page;
    ultimaPagina.value = meta.last_page;
  } catch (e) {
    error.value = e instanceof ErrorApi ? e.message : 'No fue posible cargar los equipos.';
    // Si ya hay equipos en pantalla, el bloque de error no se ve: se avisa con un toast.
    if (equipos.value.length > 0) mostrarToast(error.value, 'danger');
  } finally {
    cargando.value = false;
  }
}

/**
 * [M4] Ionic mantiene la página viva en la pila: onMounted corre una sola vez, pero
 * onIonViewWillEnter corre CADA VEZ que la persona vuelve (p. ej., al regresar del formulario).
 */
onIonViewWillEnter(() => cargar(true));

const buscar = () => cargar(true);

/** [M4] Recarga desde la página 1 y cierra el refresher, salga bien o mal. */
async function refrescar(evento: RefresherCustomEvent) {
  await cargar(true);
  await evento.target.complete();
}

/** [M4] Carga la página siguiente y cierra el infinite scroll. */
async function cargarMas(evento: InfiniteScrollCustomEvent) {
  await cargar(false);
  await evento.target.complete();
}

/**
 * TODO [M6] confirmarEliminacion(equipo, evento)
 *  1. Cierre el ion-item-sliding.
 *  2. alertController con dos botones: role 'cancel' y role 'destructive'.
 *     Lea el role con onDidDismiss(); si no es 'destructive', no haga nada.
 *  3. eliminar(equipo.id):
 *       204 → quitar el equipo de la lista (sin recargar todo), vibrar() y toast de éxito.
 *       409 → toast con el mensaje que envía la API (regla R1: equipo prestado). El equipo sigue en la lista.
 *       404 → quitarlo de la lista y avisar que ya no existe.
 */
async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  void [equipo, evento, alertController, ErrorApi, mostrarToast, vibrar, eliminar];
}

void confirmarEliminacion;
</script>

<style scoped>
.esqueleto-titulo { width: 60%; }
.esqueleto-detalle { width: 40%; }
.esqueleto-badge { width: 70px; }
</style>
