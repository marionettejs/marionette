export const classes = Object.freeze({outer:'study-outer',label:'study-label',input:'study-input',messages:'study-messages'});
export function fields(count) { return Array.from({length:count},(_,i)=>({type:'text',name:`f${i}`,label:`Field ${i}`,validation:'required',validationVisibility:'live',classes})); }
export const values = count => Object.fromEntries(fields(count).map(f=>[f.name,'']));
