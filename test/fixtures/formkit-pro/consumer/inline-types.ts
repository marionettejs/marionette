import type { FormKitInputProps } from '@formkit/inputs';
import '@formkit/pro';

// This file is checked only on 0.131.0; older releases do not declare inline.
const enabled: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['inline'] = true;
const disabled: FormKitInputProps<{ type: 'datepicker' }>['datepicker']['inline'] = false;
void [enabled, disabled];
