"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ProjectsView } from "@/features/projects/components/projects-view";
import { LandingView } from "./landing-view";

export const HomeView = () => {
  return (
    <>
      <Authenticated>
        <ProjectsView />
      </Authenticated>
      <Unauthenticated>
        <LandingView />
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen bg-sidebar flex items-center justify-center">
          <div className="size-8 rounded-lg bg-accent animate-pulse" />
        </div>
      </AuthLoading>
    </>
  );
};
