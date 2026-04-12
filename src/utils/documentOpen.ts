import type { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSignedStorageUrl, isPdfByMeta } from '@/utils/exportFileActions';

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

interface ViewerFailureState {
  sourceComponent: string;
  storagePath?: string | null;
  resolvedUrl?: string | null;
  viewerPath: 'document-route';
  finalViewer: 'DocumentViewerPage';
  openError: string;
  mimeType?: string | null;
}

const logDocumentOpen = (payload: Record<string, unknown>) => {
  console.info('[DocumentOpen]', payload);
};

const navigateToFailureRoute = (
  navigate: NavigateFunction,
  documentId: string,
  state: ViewerFailureState,
) => {
  navigate(`/documents/${documentId}`, { state });
};

export async function openDocumentById({
  documentId,
  navigate,
  sourceComponent,
  toast,
}: OpenDocumentByIdParams) {
  logDocumentOpen({
    event: 'tap',
    sourceComponent,
    routePushed: `/documents/${documentId}`,
    documentId,
  });

  try {
    const { data: rideDoc, error: rideDocError } = await supabase
      .from('ride_documents')
      .select('id, file_url, title')
      .eq('id', documentId)
      .maybeSingle();

    if (rideDocError) {
      logDocumentOpen({
        event: 'ride-document-lookup-error',
        sourceComponent,
        documentId,
        error: rideDocError.message,
      });
    }

    if (rideDoc?.file_url) {
      const resolvedUrl = await getSignedStorageUrl(rideDoc.file_url);

      logDocumentOpen({
        event: 'ride-document-resolved',
        sourceComponent,
        documentId,
        mimeType: 'application/pdf',
        storagePath: rideDoc.file_url,
        resolvedUrl,
        finalViewer: resolvedUrl ? 'native-browser-pdf' : 'DocumentViewerPage',
      });

      if (resolvedUrl) {
        navigate(`/documents/${documentId}`);
        return;
      }

      navigateToFailureRoute(navigate, documentId, {
        sourceComponent,
        storagePath: rideDoc.file_url,
        resolvedUrl: null,
        viewerPath: 'document-route',
        finalViewer: 'DocumentViewerPage',
        openError: 'Could not resolve a secure PDF URL for this document.',
        mimeType: 'application/pdf',
      });
      return;
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_path, mime_type, document_name')
      .eq('id', documentId)
      .maybeSingle();

    if (docError) {
      throw docError;
    }

    if (!doc) {
      throw new Error('Document record not found.');
    }

    const isPdf = isPdfByMeta(doc.document_name, doc.mime_type);

    logDocumentOpen({
      event: 'document-record-loaded',
      sourceComponent,
      documentId,
      mimeType: doc.mime_type,
      storagePath: doc.file_path,
      isPdf,
    });

    if (!isPdf) {
      navigate(`/documents/${documentId}`, {
        state: {
          sourceComponent,
          storagePath: doc.file_path,
          resolvedUrl: null,
          viewerPath: 'document-route',
          finalViewer: 'DocumentViewerPage',
          mimeType: doc.mime_type,
        },
      });
      return;
    }

    const resolvedUrl = await getSignedStorageUrl(doc.file_path);

    logDocumentOpen({
      event: 'pdf-url-resolved',
      sourceComponent,
      documentId,
      mimeType: doc.mime_type,
      storagePath: doc.file_path,
      resolvedUrl,
      finalViewer: resolvedUrl ? 'native-browser-pdf' : 'DocumentViewerPage',
    });

    if (resolvedUrl) {
      navigate(`/documents/${documentId}`);
      return;
    }

    navigateToFailureRoute(navigate, documentId, {
      sourceComponent,
      storagePath: doc.file_path,
      resolvedUrl: null,
      viewerPath: 'document-route',
      finalViewer: 'DocumentViewerPage',
      openError: 'Could not resolve a secure PDF URL for this document.',
      mimeType: doc.mime_type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    logDocumentOpen({
      event: 'open-failed',
      sourceComponent,
      documentId,
      error: message,
      finalViewer: 'DocumentViewerPage',
    });

    toast({
      title: 'Document could not be opened',
      description: message,
      variant: 'destructive',
    });

    navigateToFailureRoute(navigate, documentId, {
      sourceComponent,
      storagePath: null,
      resolvedUrl: null,
      viewerPath: 'document-route',
      finalViewer: 'DocumentViewerPage',
      openError: message,
      mimeType: null,
    });
  }
}
