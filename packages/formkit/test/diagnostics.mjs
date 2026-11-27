export const diagnostics = Symbol.for('@mnjs/formkit/internal-diagnostics');
export const metricsOf = owner => owner[diagnostics] ?? owner.form[diagnostics];
