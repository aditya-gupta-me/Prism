"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Allotment } from "allotment";

import { Navbar } from "./navbar";
import { Id } from "@/convex/_generated/dataModel";
import { UnauthenticatedView } from "@/features/auth/components/unauthenticated-view";
import { AuthLoadingView } from "@/features/auth/components/auth-loading-view";
import { ConversationSidebar } from "@/features/conversations/components/conversation-sidebar";
import "allotment/dist/style.css";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;
const DEFAULT_MAIN_SIZE = 1000;

export const ProjectIdLayout = ({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: Id<"projects">;
}) => {
  return (
    <>
      <Authenticated>
        <div className="w-full h-screen flex flex-col">
          <Navbar projectId={projectId} />
          <div className="flex-1 flex overflow-hidden">
            <Allotment
              className="flex-1"
              defaultSizes={[DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}
            >
              <Allotment.Pane
                snap
                minSize={MIN_SIDEBAR_WIDTH}
                maxSize={MAX_SIDEBAR_WIDTH}
                preferredSize={DEFAULT_CONVERSATION_SIDEBAR_WIDTH}
              >
                <ConversationSidebar projectId={projectId} />
              </Allotment.Pane>
              <Allotment.Pane>{children}</Allotment.Pane>
            </Allotment>
          </div>
        </div>
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedView />
      </Unauthenticated>
      <AuthLoading>
        <AuthLoadingView />
      </AuthLoading>
    </>
  );
};
