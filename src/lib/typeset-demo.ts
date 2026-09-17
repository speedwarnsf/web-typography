/** Measure inactive demo panels in their real column, without presentation
 * transforms or inherited visibility changing the compositor's decision. */
export function withDemoMeasurement<T>(elements: HTMLElement[], measure: () => T): T {
  const properties = ['transition', 'transform', 'visibility'] as const;
  const saved = elements.map(element => ({ element, hadStyle: element.hasAttribute('style'),
    values: properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)] as const) }));
  try {
    for (const element of elements) {
      element.style.setProperty('transition', 'none', 'important');
      element.style.setProperty('transform', 'none', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
    }
    return measure();
  } finally {
    for (const { element, values, hadStyle } of saved) {
      for (const [property, value, priority] of values) {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
      if (!hadStyle && !element.getAttribute('style')) element.removeAttribute('style');
    }
  }
}
