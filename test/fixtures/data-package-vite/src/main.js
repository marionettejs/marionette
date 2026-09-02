import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@marionette/data';

const runtime = createMarionette();
runtime.setDataApi(DataApi);
runtime.setStateApi(StateApi);
const model = new Model({ id: 1, label: 'one' });
const collection = new Collection([model]);

document.getElementById('app').textContent =
  `${DataApi.items(collection).length}:${DataApi.get(model, 'label')}`;
