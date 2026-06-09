import { useCallback } from "react";

import { useEditorStore } from "../store/use-editor-store";
import { Id } from "@/convex/_generated/dataModel";

export const useEditor = (projectId: Id<"projects">) => {
  const openFileAction = useEditorStore((state) => state.openFile);
  const closeTabAction = useEditorStore((state) => state.closeTab);
  const closeAllTabsAction = useEditorStore((state) => state.closeAllTabs);
  const setActiveTabAction = useEditorStore((state) => state.setActiveTab);
  const tabState = useEditorStore((state) => state.getTabState(projectId));

  const openFile = useCallback(
    (fileId: Id<"files">, options: { pinned: boolean }) => {
      openFileAction(projectId, fileId, options);
    },
    [openFileAction, projectId],
  );

  const closeTab = useCallback(
    (fileId: Id<"files">) => {
      closeTabAction(projectId, fileId);
    },
    [closeTabAction, projectId],
  );

  const closeAllTabs = useCallback(() => {
    closeAllTabsAction(projectId);
  }, [closeAllTabsAction, projectId]);

  const setActiveTab = useCallback(
    (fileId: Id<"files">) => {
      setActiveTabAction(projectId, fileId);
    },
    [setActiveTabAction, projectId],
  );

  return {
    openTabs: tabState.openTabs,
    activeTabId: tabState.activeTabId,
    previewTabId: tabState.previewTabId,
    openFile,
    closeTab,
    closeAllTabs,
    setActiveTab,
  };
};
