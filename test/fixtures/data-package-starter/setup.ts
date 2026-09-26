import { setDataApi, setStateApi } from 'marionette';
import { DataApi, StateApi } from '@mnjs/data';

// Configure the application's shared runtime before constructing any owners.
setDataApi(DataApi);
setStateApi(StateApi);
