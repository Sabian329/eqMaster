import type { ReactNode } from 'react';
import { Field } from '@chakra-ui/react';
import { fieldStyles } from '../../theme';

export function FormLabel({ children }: { children: ReactNode }) {
  return <Field.Label {...fieldStyles.label}>{children}</Field.Label>;
}

export function FormHelper({ children }: { children: ReactNode }) {
  return <Field.HelperText {...fieldStyles.helper}>{children}</Field.HelperText>;
}
