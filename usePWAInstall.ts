import { useEffect, useState } from "react";

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect already installed (PWA standalone mode)
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);
    };

    checkInstalled();

    const beforeInstallHandler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", beforeInstallHandler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    setIsInstallable(false);
  };

  return { isInstallable, isInstalled, install };
}