import { createProPlugin, currency, mask, dropdown, autocomplete, taglist, datepicker, colorpicker, repeater, transferlist } from '@formkit/pro';
import type { FormKitPlugin } from '@formkit/core';
import type { FormKitInputProps } from '@formkit/inputs';

// Type-only preparation: no key is supplied or plugin executed by this check.
declare const projectKey: string;
const plugin: FormKitPlugin = createProPlugin(projectKey, { currency, mask, dropdown, autocomplete, taglist, datepicker, colorpicker, repeater, transferlist });
const display: FormKitInputProps<{ type: 'currency' }>['currency']['currencyDisplay'] = 'none';
// @ts-expect-error The public currency display union must reject unknown modes.
const invalidDisplay: FormKitInputProps<{ type: 'currency' }>['currency']['currencyDisplay'] = 'unknown-mode';
void [plugin, display, invalidDisplay];

const autocompletePosition: FormKitInputProps<{ type: 'autocomplete' }>['autocomplete']['popoverPosition'] = 'above';
const dropdownPosition: FormKitInputProps<{ type: 'dropdown' }>['dropdown']['popoverPosition'] = 'below';
const taglistPosition: FormKitInputProps<{ type: 'taglist' }>['taglist']['popoverPosition'] = 'auto';
const datepickerPosition: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['popoverPosition'] = 'above';
const colorpickerPosition: FormKitInputProps<{ type: 'colorpicker' }>['colorpicker']['popoverPosition'] = 'below';
const monthPanels: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['paginatedPanels'] = ['month'];
// @ts-expect-error Position is a closed public union.
const invalidPosition: FormKitInputProps<{ type: 'dropdown' }>['dropdown']['popoverPosition'] = 'sideways';
void [autocompletePosition, dropdownPosition, taglistPosition, datepickerPosition, colorpickerPosition, monthPanels, invalidPosition];
const minimumDay: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['minDate'] = new Date(2026, 10, 8, 23, 59);
const maximumDay: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['maxDate'] = new Date(2026, 10, 10, 0, 1);
void [minimumDay, maximumDay];
