// Public custom input with delayed work after its choice panel closes.
export function closingInput(state) {
  return { type: 'input', features: [node => node.on('created', () => {
    node.context.open = true;
    node.context.handlers.openPanel = () => { node.context.open = true; };
    node.context.handlers.choose = event => {
      const choice = event.currentTarget;
      state.choice = choice;
      state.completion = (async() => {
        await node.input(choice.dataset.value, false);
        node.context.open = false;
        await new Promise(resolve => setTimeout(resolve, 0));
        state.completed.push({ palette: choice.parentElement.dataset.palette,
          value: node.value, connected: choice.isConnected });
      })();
      return state.completion;
    };
  })], schema: { $el: 'div', children: [
    { $el: 'button', attrs: { type: 'button', onClick: '$handlers.openPanel' }, children: 'Open choices' },
    { $el: 'div', if: '$open', attrs: { 'data-palette': 'colors', role: 'group', 'aria-label': 'Choices' },
      children: { $el: 'button', attrs: { type: 'button', 'data-value': '#00FF00', onClick: '$handlers.choose' }, children: 'Green' } }
  ] } };
}
