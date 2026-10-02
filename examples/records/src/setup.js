import { setDataApi, setDomApi, setRenderer, setStateApi } from 'marionette';
import { DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';

setDataApi(DataApi);
setStateApi(StateApi);
setDomApi(LitDomApi);
setRenderer((template, data) => template(data));
