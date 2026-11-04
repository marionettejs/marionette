import { createProPlugin, currency, mask, dropdown, autocomplete, taglist, repeater, transferlist } from '@formkit/pro';
import type { FormKitPlugin } from '@formkit/core';
import type { FormKitInputProps } from '@formkit/inputs';

// Type-only preparation: no key is supplied or plugin executed by this check.
declare const projectKey: string;
const plugin: FormKitPlugin = createProPlugin(projectKey, { currency, mask, dropdown, autocomplete, taglist, repeater, transferlist });
const display: FormKitInputProps<{ type: 'currency' }>['currency']['currencyDisplay'] = 'none';
// @ts-expect-error The public currency display union must reject unknown modes.
const invalidDisplay: FormKitInputProps<{ type: 'currency' }>['currency']['currencyDisplay'] = 'unknown-mode';
void [plugin, display, invalidDisplay];
