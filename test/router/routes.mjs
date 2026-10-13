import { createRoutes } from '@mnjs/router';

export const careRoutes = createRoutes({
  worklist: { path: '/:workspace/worklist/:worklistId', meta: { area: 'patients', isList: true } },
  schedule: { path: '/:workspace/schedule', meta: { area: 'patients', isList: true } },
  'patient:workflow': {
    path: '/:workspace/patient/:patientId/workflow',
    aliases: ['/:workspace/patient/dashboard/:patientId'],
  },
  'patient:workflow:closed': {
    path: '/:workspace/patient/:patientId/workflow/closed',
    aliases: ['/:workspace/patient/archive/:patientId'],
  },
  'patient:interactions': '/:workspace/patient/:patientId/interactions',
  'patient:interaction': '/:workspace/patient/:patientId/interactions/:interactionId',
  'patient:action': {
    path: '/:workspace/patient/:patientId/action/:actionId',
    aliases: ['/:workspace/patient/archive/:patientId/action/:actionId'],
  },
  'patient:flow': '/:workspace/patient/:patientId/flow/:flowId',
  'patient:flow:focus': '/:workspace/patient/:patientId/flow/:flowId/focus/:actionId',
  'patient:flow:action': '/:workspace/patient/:patientId/flow/:flowId/action/:actionId',
  'patient:form': '/:workspace/patient/:patientId/form/:formId',
  'legacy:patient:flow': { path: '/:workspace/flow/:flowId', aliases: ['/:workspace/flow/:flowId/details'] },
  // Positional duplicate :id names become explicit names without changing URLs.
  'program:action': '/:workspace/program/:programId/action/:actionId',
  'programFlow:action': '/:workspace/program-flow/:flowId/action/:actionId',
});
