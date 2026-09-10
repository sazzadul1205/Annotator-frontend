import { useEffect, useState } from "react";
import VersionHistoryModal from "./VersionHistoryModal";

const CommentHistoryListener = () => {
  const [state, setState] = useState({ open: false, entityType: null, entityId: null, entityName: null });

  useEffect(() => {
    const handler = (e) => {
      setState({
        open: true,
        entityType: e.detail.entityType,
        entityId: e.detail.entityId,
        entityName: e.detail.entityName,
      });
    };
    window.addEventListener("open-version-history", handler);
    return () => window.removeEventListener("open-version-history", handler);
  }, []);

  return (
    <VersionHistoryModal
      isOpen={state.open}
      onClose={() => setState({ ...state, open: false })}
      entityType={state.entityType}
      entityId={state.entityId}
      entityName={state.entityName}
    />
  );
};

export default CommentHistoryListener;