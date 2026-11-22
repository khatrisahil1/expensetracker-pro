import React from 'react';
import { BrowserRouter } from 'react-router';
import { StoreProvider } from './context/Store';
import AppRoutes from './router/AppRoutes';
import { DialogProvider } from './components/ui/DialogProvider';

// Providers only (router, data store, in-app dialogs). Pages, guards and URLs are defined in router/AppRoutes.tsx and routes.ts.
const App: React.FC = () => (
  <BrowserRouter>
    <StoreProvider>
      <DialogProvider>
        <AppRoutes />
      </DialogProvider>
    </StoreProvider>
  </BrowserRouter>
);

export default App;
