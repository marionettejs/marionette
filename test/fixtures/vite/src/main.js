import { MnObject, View } from 'marionette';

const view = new View();
const object = new MnObject();

document.getElementById('app').textContent = `${view.cid}:${object.cid}`;
