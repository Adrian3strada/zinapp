import { useEffect } from 'react';

import { useAppDialog } from '../context/AppDialogContext';
import { registerAppAlert } from '../utils/appAlert';

/** Conecta appAlert() al provider de modales. */
export default function AppDialogBridge() {
  const showDialog = useAppDialog();

  useEffect(() => {
    registerAppAlert(showDialog);
    return () => registerAppAlert(() => {});
  }, [showDialog]);

  return null;
}
