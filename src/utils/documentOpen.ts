import type { NavigateFunction } from 'react-router-dom';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

interface OpenDocumentByIdParams {
  documentId: string;
  navigate: NavigateFunction;
  sourceComponent: string;
  toast: ToastFn;
}

const logDocumentOpen = (payload: Record<string, unknown>) => {
  console.info('[DocumentOpen]', payload);
};

export async function openDocumentById({
  documentId,
  navigate,
  sourceComponent,
  toast: _toast,
}: OpenDocumentByIdParams) {
  logDocumentOpen({
    event: 'tap',
    sourceComponent,
    routePushed: `/documents/${documentId}`,
    documentId,
    finalViewer: 'DocumentViewerPage',
    openMode: 'in-app-route',
  });

  navigate(`/documents/${documentId}`, {
    state: {
      finalViewer: 'DocumentViewerPage',
      requestedAt: new Date().toISOString(),
      requestedDocumentId: documentId,
      sourceComponent,
      viewerPath: 'document-route',
    },
  });
}
