/**
 * Capa local de analítica. No envía datos a un proveedor externo.
 * En desarrollo imprime el evento. Sustituir `emit` cuando exista un SDK aprobado.
 */
export type AnalyticsEvent =
  | 'home_category_clicked'
  | 'home_restaurant_clicked'
  | 'favorite_added'
  | 'favorite_removed'
  | 'reorder_clicked'
  | 'promotion_clicked'
  | 'home_service_clicked';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

function emit(name: AnalyticsEvent, props?: AnalyticsProps) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', name, props ?? {});
  }
}

export function trackEvent(name: AnalyticsEvent, props?: AnalyticsProps) {
  emit(name, props);
}
