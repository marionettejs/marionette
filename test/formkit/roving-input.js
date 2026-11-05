// Public custom-input fixture: inactive radios select on focus, while the
// empty widget's authored tabstop permits entry without choosing an answer.
export function rovingInput(focused) {
  return { type: 'input', features: [node => node.on('created', () => {
    node.context.handlers.selectOnFocus = event => {
      focused.push(Number(event.target.value));
      void node.input(Number(event.target.value), false);
    };
    node.context.handlers.enterChoice = event => {
      if (event.key === 'ArrowRight' && !node.props.disabled) {
        event.preventDefault();
        void node.input(1, false);
      }
    };
  })], schema: {
    $el: 'div', attrs: { id: '$id + "-field"' }, children: [
      { $el: 'label', attrs: { id: '$id + "-label"' }, children: '$label' },
      { $el: 'div', attrs: { id: '$id', role: 'radiogroup',
        'aria-labelledby': '$id + "-label"', 'aria-describedby': '$id + "-help"',
        tabindex: { if: '$disabled || $value !== 0', then: -1, else: 0 }, onKeydown: '$handlers.enterChoice' },
      children: { $el: 'input', for: ['choice', [1, 2, 3]], attrs: {
        type: 'radio', id: '$id + "-" + $choice', name: '$id', value: '$choice',
        'aria-label': '$label + " " + $choice', 'aria-invalid': '$state.invalid || undefined',
        'aria-describedby': '$id + "-help"', checked: '$value === $choice', disabled: '$disabled',
        tabindex: { if: '$value === $choice', then: 0, else: -1 }, onFocus: '$handlers.selectOnFocus'
      } } },
      { $el: 'p', attrs: { id: '$id + "-help"' }, children: 'Use the arrow key to choose a score.' },
      { $el: 'ul', children: { $el: 'li', for: ['message', '$messages'], children: '$message.value' } }
    ]
  } };
}
