export function inlineBoxInsets(style: CSSStyleDeclaration) {
  const values = [style.paddingLeft, style.paddingRight, style.marginLeft, style.marginRight,
    style.borderLeftWidth, style.borderRightWidth].map(value => parseFloat(value) || 0);
  return {
    left: values[0] + values[2] + values[4],
    right: values[1] + values[3] + values[5],
    marginLeft: values[2], marginRight: values[3],
    supported: values.every(value => value >= 0) && style.getPropertyValue('box-decoration-break') !== 'clone'
      && style.getPropertyValue('-webkit-box-decoration-break') !== 'clone',
  };
}
