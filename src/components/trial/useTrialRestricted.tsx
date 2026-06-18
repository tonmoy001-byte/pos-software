"use client";

import { useState, useCallback } from "react";
import { useTrialGuard } from "./TrialGuardProvider";
import { TrialRestrictedModal } from "./TrialRestrictedModal";

const TrialModal = TrialRestrictedModal;

export function useTrialRestricted() {
  const { canWrite, isExpired } = useTrialGuard();
  const [modalAction, setModalAction] = useState<string | null>(null);

  const checkAction = useCallback(
    (action: string): boolean => {
      if (canWrite) return true;
      setModalAction(action);
      return false;
    },
    [canWrite]
  );

  const closeModal = useCallback(() => setModalAction(null), []);

  function RestrictedModal() {
    return (
      <TrialModal
        isOpen={modalAction !== null}
        onClose={closeModal}
        action={modalAction ?? ""}
      />
    );
  }

  return { canWrite, isExpired, checkAction, RestrictedModal };
}
