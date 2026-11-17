import { createContext } from 'reka-ui';
import type { PreviewContext } from '#ui/components/preview/types';

export const [usePreview, providePreviewContext] = createContext<PreviewContext>('Preview');
